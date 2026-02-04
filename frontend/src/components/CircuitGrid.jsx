import React, { useState, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';

const CELL_SIZE = 60;
const GAP_SIZE = 20;
const ROW_HEIGHT = CELL_SIZE + GAP_SIZE;

// Represents a single timeline spot for a qubit
const DropCell = ({ moment, qubit, gate, onGateMouseDown }) => {
    const { isOver, setNodeRef } = useDroppable({
        id: `${moment}-${qubit}`,
    });

    return (
        <div
            ref={setNodeRef}
            className={`drop-cell ${isOver ? 'over' : ''}`}
        >
            {gate && (
                <GateRenderer gate={gate} onMouseDown={(e) => onGateMouseDown(e, gate)} />
            )}
        </div>
    );
};

const GateRenderer = ({ gate, onMouseDown }) => {
    if (gate.type === 'CNOT') {
        const target = gate.target !== undefined ? gate.target : gate.qubit; // fallback
        const distance = target - gate.qubit;
        const height = Math.abs(distance * ROW_HEIGHT);

        const lineStyle = {
            height: `${height}px`,
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '4px',
            backgroundColor: '#42A5F5',
            transform: `translateX(-50%) ${distance < 0 ? 'translateY(-100%)' : ''}`,
            zIndex: 10,
            pointerEvents: 'none'
        };

        const targetStyle = {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) translateY(${distance * ROW_HEIGHT}px)`,
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            border: '3px solid #42A5F5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#42A5F5',
            fontWeight: 'bold',
            fontSize: '20px',
            pointerEvents: 'none',
            backgroundColor: '#1e1e1e',
            zIndex: 11
        };

        return (
            <div
                className="placed-gate gate-CNOT-container"
                onMouseDown={onMouseDown}
                style={{ position: 'relative', width: '100%', height: '100%' }}
            >
                <div className="control-dot" />
                <div className="connection-line" style={lineStyle} />
                <div className="target-indicator" style={targetStyle}>+</div>
            </div>
        );
    }

    // Check for rotation parameter
    let paramDisplay = null;
    if (['RX', 'RY', 'RZ'].includes(gate.type) && gate.parameter !== undefined) {
        // Calculate multiplier of PI
        const mult = gate.parameter / Math.PI;
        // Round to 2 decimals for display
        const rounded = Math.round(mult * 100) / 100;
        paramDisplay = <div style={{ fontSize: '10px', marginTop: '-2px' }}>{rounded}π</div>;
    }

    return (
        <div
            className={`placed-gate gate-${gate.type}`}
            onMouseDown={onMouseDown}
            style={{ flexDirection: 'column' }}
        >
            <div>{gate.type}</div>
            {paramDisplay}
        </div>
    );
};


const CircuitGrid = ({ qubits, gates, onAddQubit, onRemoveQubit, onUpdateGate, onRemoveGate, selectedMoment, onMomentSelect }) => {
    const moments = Array.from({ length: 10 }, (_, i) => i);
    const [activeMenu, setActiveMenu] = React.useState(null);
    const [editModal, setEditModal] = React.useState({ show: false, gate: null, targetV: '', parameterV: '' });

    // Drag to connect state
    const [connectingGate, setConnectingGate] = useState(null);
    const [dragLine, setDragLine] = useState(null);

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

    const handleGateMouseDown = (e, gate) => {
        // If it's CNOT, start connecting drag
        if (gate.type === 'CNOT') {
            e.preventDefault();
            e.stopPropagation();

            const rect = e.currentTarget.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            setConnectingGate({
                gate,
                startX: centerX,
                startY: centerY
            });
            setDragLine({ x: e.clientX, y: e.clientY });
        }
    };

    const handleGlobalMouseMove = (e) => {
        if (connectingGate) {
            setDragLine({ x: e.clientX, y: e.clientY });
        }
    };

    const handleGlobalMouseUp = (e) => {
        if (connectingGate) {
            const line = document.elementFromPoint(e.clientX, e.clientY)?.closest('.qubit-line');
            if (line && line.dataset.qubitIndex) {
                const targetIndex = parseInt(line.dataset.qubitIndex);
                if (!isNaN(targetIndex) && targetIndex !== connectingGate.gate.qubit) {
                    onUpdateGate(connectingGate.gate.id, { target: targetIndex });
                }
            }
            setConnectingGate(null);
            setDragLine(null);
            return;
        }
    };

    useEffect(() => {
        if (connectingGate) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        } else {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [connectingGate]);


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
            } else if (action === 'edit' || action === 'edit-param') {
                // For rotation gates, preset parameterV as multiplier of PI
                let initialParam = '';
                if (['RX', 'RY', 'RZ'].includes(gate.type)) {
                    const rads = gate.parameter !== undefined ? gate.parameter : Math.PI / 2;
                    initialParam = rads / Math.PI;
                }

                setEditModal({
                    show: true,
                    gate: gate,
                    targetV: gate.target !== undefined ? gate.target : (gate.qubit + 1) % qubits,
                    parameterV: initialParam
                });
            }
        }
        setActiveMenu(null);
    };

    const saveEdit = () => {
        if (!editModal.gate) return;
        const updates = {};

        // Update Target (if applicable/shown)
        if (['CNOT'].includes(editModal.gate.type)) {
            const newTarget = parseInt(editModal.targetV, 10);
            if (!isNaN(newTarget) && newTarget >= 0 && newTarget < qubits) {
                updates.target = newTarget;
            } else {
                alert("Invalid qubit index");
                return;
            }
        }

        // Update Parameter (if applicable/shown)
        if (['RX', 'RY', 'RZ'].includes(editModal.gate.type)) {
            const multiplier = parseFloat(editModal.parameterV);
            if (!isNaN(multiplier)) {
                // Convert back to radians
                updates.parameter = multiplier * Math.PI;
            } else {
                alert("Invalid parameter");
                return;
            }
        }

        if (Object.keys(updates).length > 0) {
            onUpdateGate(editModal.gate.id, updates);
            closeModal();
        }
    };

    const closeModal = () => {
        setEditModal({ show: false, gate: null, targetV: '', parameterV: '' });
    };

    const onColumnClick = (momentIndex, e) => {
        e.stopPropagation();
        if (onMomentSelect) onMomentSelect(momentIndex);
    };

    return (
        <div className="circuit-grid" onClick={() => setActiveMenu(null)} style={{ position: 'relative' }}>
            {/* Background Columns for Selection */}
            <div className="moments-background" style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '60px', // Matches .qubit-label width
                right: 0,
                display: 'flex',
                flexDirection: 'row',
                zIndex: 0,
                pointerEvents: 'auto',
            }}>
                {moments.map(momentIndex => {
                    const isSelected = selectedMoment === momentIndex;
                    return (
                        <div
                            key={momentIndex}
                            onClick={(e) => onColumnClick(momentIndex, e)}
                            style={{
                                width: '60px', // Matches .drop-cell width
                                marginRight: '10px', // Matches .drop-cell margin-right
                                backgroundColor: isSelected ? 'rgba(66, 165, 245, 0.1)' : 'transparent',
                                borderLeft: isSelected ? '1px solid rgba(66, 165, 245, 0.3)' : '1px solid transparent',
                                borderRight: isSelected ? '1px solid rgba(66, 165, 245, 0.3)' : '1px solid transparent',
                                borderTop: '1px solid transparent', // Match full border presence of DropCell
                                borderBottom: '1px solid transparent', // Match full border
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                flexShrink: 0, // Ensure background columns don't shrink
                            }}
                            title={`Select Moment ${momentIndex}`}
                        />
                    );
                })}
            </div>


            {/* Drag Line Overlay */}
            {connectingGate && dragLine && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 9999
                }}>
                    <svg width="100%" height="100%">
                        <line
                            x1={connectingGate.startX}
                            y1={connectingGate.startY}
                            x2={dragLine.x}
                            y2={dragLine.y}
                            stroke="#42A5F5"
                            strokeWidth="4"
                            strokeDasharray="5,5"
                        />
                        <circle cx={dragLine.x} cy={dragLine.y} r="15" fill="none" stroke="#42A5F5" strokeWidth="3" />
                        <text x={dragLine.x} y={dragLine.y} fill="#42A5F5" dy="5" dx="-4" fontWeight="bold">+</text>
                    </svg>
                </div>
            )}

            {editModal.show && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Edit Gate</h3>

                        {/* Target Input - Only for CNOT (though CNOT uses drag, we can keep it here too) */}
                        {editModal.gate.type === 'CNOT' && (
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
                        )}

                        {/* Parameter Input - Only for Rotation Gates */}
                        {['RX', 'RY', 'RZ'].includes(editModal.gate.type) && (
                            <div className="form-group">
                                <label>Rotation Angle (multiplier of π):</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={editModal.parameterV}
                                    onChange={e => setEditModal({ ...editModal, parameterV: e.target.value })}
                                />
                                <div style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>
                                    Example: 0.5 = π/2, 1 = π, 2 = 2π
                                </div>
                            </div>
                        )}

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
                                {activeMenu.gate.type === 'CNOT' && <div onClick={() => handleAction('edit')}>Edit Target</div>}
                                {['RX', 'RY', 'RZ'].includes(activeMenu.gate.type) && <div onClick={() => handleAction('edit')}>Edit Parameter</div>}
                                <div onClick={() => handleAction('delete')} className="danger">Delete Gate</div>
                            </>
                        )}
                    </div>
                </>
            )}

            {Array.from({ length: qubits }).map((_, qubitIndex) => (
                <div
                    key={qubitIndex}
                    className="qubit-line"
                    data-qubit-index={qubitIndex}
                    style={{ pointerEvents: 'auto' }}
                >
                    <div
                        className="qubit-label"
                        onClick={(e) => handleQubitClick(e, qubitIndex)}
                        style={{
                            cursor: 'pointer',
                            position: 'relative',
                            zIndex: 2,
                            flexShrink: 0,
                            minWidth: '60px'
                        }}
                        title="Click to manage qubit"
                    >
                        Q{qubitIndex}
                    </div>
                    <div className="timeline" style={{ zIndex: 1 }}>
                        {moments.map(momentIndex => {
                            const gate = gates.find(g => g.qubit === qubitIndex && g.moment === momentIndex);
                            return (
                                <div
                                    key={momentIndex}
                                    style={{ height: '100%' }}
                                    onContextMenu={(e) => {
                                        if (gate) {
                                            e.preventDefault();
                                            handleGateClick(e, gate);
                                        }
                                    }}
                                >
                                    <div onClick={(e) => {
                                        if (gate && gate.type !== 'CNOT') {
                                            e.stopPropagation();
                                            handleGateClick(e, gate);
                                        }
                                        if (!gate) {
                                            onColumnClick(momentIndex, e);
                                        }
                                    }}>
                                        <DropCell
                                            moment={momentIndex}
                                            qubit={qubitIndex}
                                            gate={gate}
                                            onGateMouseDown={handleGateMouseDown}
                                        />
                                    </div>
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
