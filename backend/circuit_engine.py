import cirq
from pydantic import BaseModel
from typing import List, Optional, Dict, Union
import numpy as np

class GateOp(BaseModel):
    type: str # H, X, Y, Z, CNOT, SWAP, CZ, RX, RY, RZ
    qubit: Optional[int] = None # For 1-qubit gates
    target: Optional[int] = None # For CNOT/CZ target
    control: Optional[int] = None # For CNOT/CZ control
    controls: Optional[List[int]] = None # For generic multi-control
    parameter: Optional[Union[float, str]] = None # For rotation gates, value in radians
    moment: int

class CircuitData(BaseModel):
    qubits: int
    qubit_names: Optional[List[str]] = None
    gates: List[GateOp]

class StepResult(BaseModel):
    moment: int
    state_vector: List[Dict[str, float]]
    bloch_vectors: List[List[float]]

class SimulationResult(BaseModel):
    state_vector: List[Dict[str, float]] # Final state (same as last step)
    bloch_vectors: List[List[float]] # Final Bloch vectors
    steps: List[StepResult] # History of states by moment


def partial_trace(state_vector, keep_qubit_idx, n_qubits):
    """
    Computes the reduced density matrix of a single qubit from a state vector.
    """
    # reshape to [2, 2, ..., 2] (N times)
    state = state_vector.reshape([2] * n_qubits)
    
    # We want to contract all indices except keep_qubit_idx against their conjugate
    # indices = [0, 1, ..., N-1]
    # We sum over all indices != keep_qubit_idx
    
    # Move the target qubit to axis 0
    state = np.moveaxis(state, keep_qubit_idx, 0)
    # Now state is (2, 2^(N-1)) essentially
    state = state.reshape((2, 2**(n_qubits-1)))
    
    # rho = psi * psi^dag
    # We trace over the second dimension
    # rho_ab = sum_k psi_ak * conj(psi_bk)
    
    rho = np.dot(state, state.conj().T)
    return rho

def density_matrix_to_bloch(rho):
    """
    Returns [x, y, z] from 2x2 density matrix.
    rho = 1/2 (I + xX + yY + zZ)
    x = Tr(rho X), y = Tr(rho Y), z = Tr(rho Z)
    """
    X = np.array([[0, 1], [1, 0]], dtype=complex)
    Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
    Z = np.array([[1, 0], [0, -1]], dtype=complex)
    
    x = np.real(np.trace(np.dot(rho, X)))
    y = np.real(np.trace(np.dot(rho, Y)))
    z = np.real(np.trace(np.dot(rho, Z)))
    return [x, y, z]

def build_circuit(data: CircuitData):
    if data.qubit_names and len(data.qubit_names) == data.qubits:
        qubits = [cirq.NamedQubit(name) for name in data.qubit_names]
    else:
        qubits = cirq.LineQubit.range(data.qubits)
        
    circuit = cirq.Circuit()
    
    # Group by moment
    max_moment = 0
    if data.gates:
        max_moment = max(g.moment for g in data.gates)
    
    # Create layers
    # Dictionary of moment_index -> list(ops)
    moment_ops = {i: [] for i in range(max_moment + 1)}
    
    for g in data.gates:
        op = None
        if g.type == "H":
            if g.qubit is not None:
                op = cirq.H(qubits[g.qubit])
        elif g.type == "X":
            if g.qubit is not None:
                op = cirq.X(qubits[g.qubit])
        elif g.type == "Y":
            if g.qubit is not None:
                op = cirq.Y(qubits[g.qubit])
        elif g.type == "Z":
            if g.qubit is not None:
                op = cirq.Z(qubits[g.qubit])
        elif g.type == "RX":
            if g.qubit is not None:
                val = float(g.parameter) if g.parameter is not None else np.pi / 2
                op = cirq.rx(val)(qubits[g.qubit])
        elif g.type == "RY":
            if g.qubit is not None:
                val = float(g.parameter) if g.parameter is not None else np.pi / 2
                op = cirq.ry(val)(qubits[g.qubit])
        elif g.type == "RZ":
            if g.qubit is not None:
                val = float(g.parameter) if g.parameter is not None else np.pi / 2
                op = cirq.rz(val)(qubits[g.qubit])
        elif g.type == "CNOT":
            if g.control is not None and g.target is not None:
                op = cirq.CNOT(qubits[g.control], qubits[g.target])
        
        # Apply generic controls if present
        if op and g.controls:
            # helper to get qubit objects for control indices
            control_qubits = [qubits[idx] for idx in g.controls]
            op = op.controlled_by(*control_qubits)
            
        if op:
            moment_ops[g.moment].append(op)
        
    for i in range(max_moment + 1):
        if moment_ops[i]:
            circuit.append(moment_ops[i], strategy=cirq.InsertStrategy.NEW_THEN_INLINE)
        else:
            pass
        
    return circuit

def process_state(state_vector, n_qubits):
    formatted_state = []
    for amp in state_vector:
        formatted_state.append({"real": float(amp.real), "imag": float(amp.imag)})
        
    bloch_vectors = []
    for i in range(n_qubits):
        rho = partial_trace(state_vector, i, n_qubits)
        vec = density_matrix_to_bloch(rho)
        bloch_vectors.append(vec)
        
    return formatted_state, bloch_vectors

def run_simulation(data: CircuitData) -> SimulationResult:
    circuit = build_circuit(data)
    # Need consistent qubit ordering for simulation result
    if data.qubit_names and len(data.qubit_names) == data.qubits:
        qubits = [cirq.NamedQubit(name) for name in data.qubit_names]
    else:
        qubits = cirq.LineQubit.range(data.qubits)
        
    simulator = cirq.Simulator()
    
    steps = []
    
    # Initial state (Zero state)
    initial_state = cirq.to_valid_state_vector(0, data.qubits)
    fmt_state, bloch = process_state(initial_state, data.qubits)
    steps.append(StepResult(moment=-1, state_vector=fmt_state, bloch_vectors=bloch))
    
    current_moment = 0
    # Collect steps
    for step in simulator.simulate_moment_steps(circuit, qubit_order=qubits):
        state = step.state_vector() 
        fmt_state, bloch = process_state(state, data.qubits)
        steps.append(StepResult(moment=current_moment, state_vector=fmt_state, bloch_vectors=bloch))
        current_moment += 1
        
    # The final result is the last step if steps exist, else initial
    final_step = steps[-1]
    
    return SimulationResult(
        state_vector=final_step.state_vector,
        bloch_vectors=final_step.bloch_vectors,
        steps=steps
    )

def generate_cirq_code(data: CircuitData) -> Dict[str, str]:
    circuit = build_circuit(data)
    diagram = str(circuit)
    
    # Generate readable code
    code = "import cirq\n\n"
    if data.qubit_names and len(data.qubit_names) == data.qubits:
        names_str = ", ".join([f"'{name}'" for name in data.qubit_names])
        code += f"qubits = [cirq.NamedQubit(name) for name in [{names_str}]]\n"
    else:
        code += f"qubits = cirq.LineQubit.range({data.qubits})\n"
        
    code += "circuit = cirq.Circuit()\n\n"
    
    # We can iterate over operations in the circuit
    for moment in circuit:
        for op in moment:
             # repr(op) generally uses the qubit name if it's NamedQubit
             code += f"circuit.append({repr(op)}, strategy=cirq.InsertStrategy.NEW_THEN_INLINE)\n"
            
    code += "\nprint(circuit)"
    
    return {"diagram": diagram, "source_code": code}
