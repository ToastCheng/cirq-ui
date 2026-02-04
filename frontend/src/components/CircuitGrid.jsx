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

const CircuitGrid = ({ qubits, gates, onAddQubit, onRemoveQubit }) => {
    // Assuming a fixed number of moments used for now, say 10
    const moments = Array.from({ length: 10 }, (_, i) => i);
    const [activeMenu, setActiveMenu] = React.useState(null);

    const handleQubitClick = (e, index) => {
        e.preventDefault();
        // Toggle if same index
        if (activeMenu?.qubitIndex === index) {
            setActiveMenu(null);
        } else {
            setActiveMenu({
                qubitIndex: index,
                x: e.clientX,
                y: e.clientY
            });
        }
    };

    const handleAction = (action) => {
        if (!activeMenu) return;
        const { qubitIndex } = activeMenu;

        if (action === 'add-before') {
            onAddQubit(qubitIndex, 'before');
        } else if (action === 'add-after') {
            onAddQubit(qubitIndex, 'after');
        } else if (action === 'remove') {
            onRemoveQubit(qubitIndex);
        }
        setActiveMenu(null);
    };

    return (
        <div className="circuit-grid">
            {activeMenu && (
                <>
                    <div
                        className="menu-backdrop"
                        onClick={() => setActiveMenu(null)}
                    />
                    <div
                        className="context-menu"
                        style={{ top: activeMenu.y, left: activeMenu.x }}
                    >
                        <div onClick={() => handleAction('add-before')}>Add Qubit Before</div>
                        <div onClick={() => handleAction('add-after')}>Add Qubit After</div>
                        <div onClick={() => handleAction('remove')} className="danger">Remove Qubit</div>
                    </div>
                </>
            )}

            {Array.from({ length: qubits }).map((_, qubitIndex) => (
                <div key={qubitIndex} className="qubit-line">
                    <div
                        className="qubit-label"
                        onClick={(e) => handleQubitClick(e, qubitIndex)}
                        style={{ cursor: 'pointer', position: 'relative' }}
                        title="Click to manage qubit"
                    >
                        Q{qubitIndex}
                    </div>
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
