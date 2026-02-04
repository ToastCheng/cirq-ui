import React from 'react';
import { useDroppable } from '@dnd-kit/core';

// Represents a single timeline spot for a qubit
const DropCell = ({ moment, qubit, gate }) => {
    const { isOver, setNodeRef } = useDroppable({
        id: `${moment}-${qubit}`,
    });

    return (
        <div
            ref={setNodeRef}
            className={`drop-cell ${isOver ? 'over' : ''}`}
        >
            {gate && (
                <div className={`placed-gate gate-${gate.type}`}>
                    {gate.type}
                </div>
            )}
        </div>
    );
};

const CircuitGrid = ({ qubits, gates }) => {
    // Assuming a fixed number of moments used for now, say 10
    const moments = Array.from({ length: 10 }, (_, i) => i);

    return (
        <div className="circuit-grid">
            {Array.from({ length: qubits }).map((_, qubitIndex) => (
                <div key={qubitIndex} className="qubit-line">
                    <div className="qubit-label">Q{qubitIndex}</div>
                    <div className="timeline">
                        {moments.map(momentIndex => {
                            // Find if there is a gate at this position
                            const gate = gates.find(g => g.qubit === qubitIndex && g.moment === momentIndex);
                            return (
                                <DropCell
                                    key={momentIndex}
                                    moment={momentIndex}
                                    qubit={qubitIndex}
                                    gate={gate}
                                />
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default CircuitGrid;
