import cirq
from pydantic import BaseModel
from typing import List, Optional, Dict
import numpy as np

class GateOp(BaseModel):
    type: str # H, X, Y, Z, CNOT, SWAP, CZ
    qubit: Optional[int] = None # For 1-qubit gates
    target: Optional[int] = None # For CNOT/CZ target
    control: Optional[int] = None # For CNOT/CZ control
    moment: int

class CircuitData(BaseModel):
    qubits: int
    gates: List[GateOp]

class SimulationResult(BaseModel):
    state_vector: List[Dict[str, float]] # Complex numbers as {real, imag}
    bloch_vectors: List[List[float]] # [x, y, z] for each qubit


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
    qubits = cirq.LineQubit.range(data.qubits)
    circuit = cirq.Circuit()
    
    # Sort gates by moment just in case, though we can insert them freely
    # Cirq handles moments automatically effectively if we use 'append' for layers,
    # but here we might want precise control. 
    # Simple approach: Create a list of moments.
    
    # Group by moment
    max_moment = 0
    if data.gates:
        max_moment = max(g.moment for g in data.gates)
    
    # Create layers
    # Dictionary of moment_index -> list(ops)
    moment_ops = {i: [] for i in range(max_moment + 1)}
    
    for g in data.gates:
        if g.type == "H":
            if g.qubit is not None:
                moment_ops[g.moment].append(cirq.H(qubits[g.qubit]))
        elif g.type == "X":
            if g.qubit is not None:
                moment_ops[g.moment].append(cirq.X(qubits[g.qubit]))
        elif g.type == "Y":
            if g.qubit is not None:
                moment_ops[g.moment].append(cirq.Y(qubits[g.qubit]))
        elif g.type == "Z":
            if g.qubit is not None:
                moment_ops[g.moment].append(cirq.Z(qubits[g.qubit]))
        elif g.type == "CNOT":
            if g.control is not None and g.target is not None:
                moment_ops[g.moment].append(cirq.CNOT(qubits[g.control], qubits[g.target]))
        # Add more gates as needed
        
    for i in range(max_moment + 1):
        circuit.append(moment_ops[i]) # Cirq strategy: EARLIEST usually, but appending moments preserves order
        
    return circuit

def run_simulation(data: CircuitData) -> SimulationResult:
    circuit = build_circuit(data)
    simulator = cirq.Simulator()
    result = simulator.simulate(circuit)
    
    final_state = result.final_state_vector
    
    # Format state vector
    formatted_state = []
    for amp in final_state:
        formatted_state.append({"real": float(amp.real), "imag": float(amp.imag)})
        
    # Calculate Bloch vectors
    bloch_vectors = []
    for i in range(data.qubits):
        rho = partial_trace(final_state, i, data.qubits)
        vec = density_matrix_to_bloch(rho)
        bloch_vectors.append(vec)
        
    return SimulationResult(state_vector=formatted_state, bloch_vectors=bloch_vectors)

def generate_cirq_code(data: CircuitData) -> str:
    circuit = build_circuit(data)
    return str(circuit) # This gives the diagram. 
    # To give code, we might need to construct string manually or use repr?
    # circuit.__repr__ gives 'cirq.Circuit(...)'
    
    # Let's generate readable code
    code = "import cirq\n\n"
    code += f"qubits = cirq.LineQubit.range({data.qubits})\n"
    code += "circuit = cirq.Circuit()\n\n"
    
    # We can iterate over operations in the circuit
    for moment in circuit:
        for op in moment:
            code += f"circuit.append({op})\n"
            
    code += "\nprint(circuit)"
    return code
