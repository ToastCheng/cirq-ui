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

const CircuitGrid = ({ qubits, gates, onAddQubit, onRemoveQubit, onUpdateGate, onRemoveGate }) => {
    // Assuming a fixed number of moments used for now, say 10
    const moments = Array.from({ length: 10 }, (_, i) => i);
    const [activeMenu, setActiveMenu] = React.useState(null);
    const [editModal, setEditModal] = React.useState({ show: false, gate: null, targetV: '' });

    const handleQubitClick = (e, index) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveMenu(activeMenu?.type === 'qubit' && activeMenu.index === index ? null : {
            type: 'qubit',
            index,
            x: e.clientX,
            y: e.clientY
        });
    };

    const handleGateClick = (e, gate) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveMenu(activeMenu?.type === 'gate' && activeMenu.gate.id === gate.id ? null : {
            type: 'gate',
            gate,
            x: e.clientX,
            y: e.clientY
        });
    };

    const handleAction = (action) => {
        if (!activeMenu) return;

        if (activeMenu.type === 'qubit') {
            const qubitIndex = activeMenu.index;
            if (action === 'add-before') onAddQubit(qubitIndex, 'before');
            else if (action === 'add-after') onAddQubit(qubitIndex, 'after');
            else if (action === 'remove') onRemoveQubit(qubitIndex);
        } else if (activeMenu.type === 'gate') {
            const gate = activeMenu.gate;
            if (action === 'delete') {
                onRemoveGate(gate.id);
            } else if (action === 'edit') {
                // Open Modal
                setEditModal({
                    show: true,
                    gate: gate,
                    targetV: gate.target !== undefined ? gate.target : (gate.qubit + 1) % qubits
                });
            }
        }
        setActiveMenu(null);
    };

    const saveEdit = () => {
        if (!editModal.gate) return;
        const newTarget = parseInt(editModal.targetV, 10);
        if (!isNaN(newTarget) && newTarget >= 0 && newTarget < qubits) {
            onUpdateGate(editModal.gate.id, { target: newTarget });
            closeModal();
        } else {
            alert("Invalid qubit index");
        }
    };

    const closeModal = () => {
        setEditModal({ show: false, gate: null, targetV: '' });
    };

    return (
        <div className="circuit-grid" onClick={() => setActiveMenu(null)}>
            {editModal.show && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Edit Gate</h3>
                        <div className="form-group">
                            <label>Target Qubit Index:</label>
                            <input
                                type="number"
                                value={editModal.targetV}
                                onChange={e => setEditModal({ ...editModal, targetV: e.target.value })}
                                min="0"
                                max={qubits - 1}
                            />
                        </div>
                        <div className="modal-actions">
                            <button onClick={closeModal} className="btn-cancel">Cancel</button>
                            <button onClick={saveEdit} className="btn-save">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {activeMenu && (
                <>
                    <div
                        className="menu-backdrop"
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(null); }}
                    />
                    <div
                        className="context-menu"
                        style={{ top: activeMenu.y, left: activeMenu.x }}
                    >
                        {activeMenu.type === 'qubit' && (
                            <>
                                <div onClick={() => handleAction('add-before')}>Add Qubit Before</div>
                                <div onClick={() => handleAction('add-after')}>Add Qubit After</div>
                                <div onClick={() => handleAction('remove')} className="danger">Remove Qubit</div>
                            </>
                        )}
                        {activeMenu.type === 'gate' && (
                            <>
                                <div onClick={() => handleAction('edit')}>Edit Target</div>
                                <div onClick={() => handleAction('delete')} className="danger">Delete Gate</div>
                            </>
                        )}
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
                                <div key={momentIndex} onClick={(e) => gate && handleGateClick(e, gate)}>
                                    <DropCell
                                        moment={momentIndex}
                                        qubit={qubitIndex}
                                        gate={gate}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default CircuitGrid;
