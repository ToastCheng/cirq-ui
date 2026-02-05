import React, { useState, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';

const CELL_SIZE = 30;
const GAP_SIZE = 12;
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
    // Helper to render control connection lines and dots
    const renderControls = () => {
        if (!gate.controls || gate.controls.length === 0) return null;

        // Calculate offsets relative to current gate position (gate.qubit)
        // gate.qubit is the row where this renderer is mounted.
        return gate.controls.map((controlIndex) => {
            const distance = controlIndex - gate.qubit; // e.g. control=0, gate=1 -> -1 (up)
            const height = Math.abs(distance * ROW_HEIGHT);

            // Line style
            const lineStyle = {
                height: `${height}px`,
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: '4px',
                backgroundColor: '#42A5F5',
                transformOrigin: 'top center',
                // If distance < 0 (control implies UP), we draw line UP.
                // transform handles the direction or we set top/bottom.
                // Easier: translate.
                transform: `translateX(-50%) ${distance < 0 ? 'translateY(-100%)' : ''}`,
                zIndex: 9,
                pointerEvents: 'none'
            };

            // Dot style
            const dotStyle = {
                position: 'absolute',
                left: '50%',
                top: '50%',
                // Move dot to the control line
                transform: `translate(-50%, -50%) translateY(${distance * ROW_HEIGHT}px)`,
                width: '14px',
                height: '14px',
                backgroundColor: '#1e1e1e', // Match bg
                border: '4px solid #42A5F5',
                borderRadius: '50%',
                zIndex: 12,
                pointerEvents: 'none'
            };

            return (
                <div key={controlIndex}>
                    <div style={lineStyle} />
                    <div style={dotStyle} />
                </div>
            );
        });
    };

    if (gate.type === 'CNOT') {
        const target = gate.target !== undefined ? gate.target : gate.qubit; // fallback
        const distance = target - gate.qubit;
        const height = Math.abs(distance * ROW_HEIGHT);

        // Standard CNOT line (control -> target)
        const lineStyle = {
            height: `${height}px`,
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '2px', // Thinner line for smaller scale
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
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            border: '2px solid #42A5F5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#42A5F5',
            fontWeight: 'bold',
            fontSize: '14px',
            pointerEvents: 'none',
            backgroundColor: '#1e1e1e',
            zIndex: 11
        };

        return (
            <div
                className="placed-gate gate-CNOT-container"
                onMouseDown={onMouseDown}
                style={{
                    position: 'relative',
                    boxSizing: 'border-box',
                    width: '30px',
                    height: '30px',
                    display: 'block' // Enforce block to respect dimensions
                }}
            >
                {/* Extra generic controls */}
                {renderControls()}
                {/* Standard CNOT parts */}
                <div className="control-dot" style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '10px',
                    height: '10px',
                    transform: 'translate(-50%, -50%)',
                    boxSizing: 'border-box',
                    borderRadius: '50%',
                    zIndex: 15 // Ensure on top
                }} />
                <div className="connection-line" style={lineStyle} />
                <div className="target-indicator" style={{ ...targetStyle, boxSizing: 'border-box' }}>+</div>
            </div>
        );
    }

    // Check for rotation parameter
    let paramDisplay = null;
    if (['RX', 'RY', 'RZ'].includes(gate.type) && gate.parameter !== undefined) {
        const mult = gate.parameter / Math.PI;
        const rounded = Math.round(mult * 100) / 100;
        paramDisplay = <div style={{ fontSize: '10px', marginTop: '-2px' }}>{rounded}π</div>;
    }

    return (
        <div
            className={`placed-gate gate-${gate.type}`}
            onMouseDown={onMouseDown}
            style={{ flexDirection: 'column', position: 'relative' }}
        >
            {renderControls()}
            <div style={{ zIndex: 13 }}>{gate.type}</div>
            {paramDisplay && <div style={{ zIndex: 13 }}>{paramDisplay}</div>}
        </div>
    );
};


const CircuitGrid = ({ qubits, momentCount, qubitNames, gates, onAddQubit, onRemoveQubit, onRenameQubit, onUpdateGate, onRemoveGate, selectedMoment, onMomentSelect, onAddMoments }) => {
    const moments = Array.from({ length: momentCount }, (_, i) => i);
    const [activeMenu, setActiveMenu] = React.useState(null);
    const [editModal, setEditModal] = React.useState({ show: false, gate: null, targetV: '', parameterV: '' });
    const [renameModal, setRenameModal] = React.useState({ show: false, index: -1, name: '' });
    const [controlModal, setControlModal] = React.useState({ show: false, gate: null, controls: [] });

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
            else if (action === 'rename') {
                setRenameModal({
                    show: true,
                    index: qubitIndex,
                    name: qubitNames && qubitNames[qubitIndex] ? qubitNames[qubitIndex] : `${qubitIndex}`
                });
            }
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
            } else if (action === 'add-control') {
                // Open modal to select controls
                setControlModal({
                    show: true,
                    gate: gate,
                    // Pre-select existing controls
                    controls: gate.controls ? [...gate.controls] : []
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

    const saveRename = () => {
        if (renameModal.index === -1) return;
        if (onRenameQubit) {
            onRenameQubit(renameModal.index, renameModal.name);
        }
        closeRenameModal();
    };

    const saveAddControl = () => {
        if (!controlModal.gate) return;

        onUpdateGate(controlModal.gate.id, { controls: controlModal.controls });
        closeControlModal();
    };

    const closeModal = () => {
        setEditModal({ show: false, gate: null, targetV: '', parameterV: '' });
    };

    const closeRenameModal = () => {
        setRenameModal({ show: false, index: -1, name: '' });
    };

    const closeControlModal = () => {
        setControlModal({ show: false, gate: null, controls: [] });
    };

    const toggleControl = (index) => {
        if (!controlModal.gate) return;
        // Don't allow selecting the gate's own qubit or its target
        if (index === controlModal.gate.qubit) return;
        if (controlModal.gate.type === 'CNOT' && controlModal.gate.target === index) return;

        setControlModal(prev => {
            const exists = prev.controls.includes(index);
            let newControls;
            if (exists) newControls = prev.controls.filter(c => c !== index);
            else newControls = [...prev.controls, index];

            return { ...prev, controls: newControls };
        });
    };

    const CELL_SIZE = 30;
    const GAP_SIZE = 12;
    const ROW_HEIGHT = CELL_SIZE + GAP_SIZE;

    const onColumnClick = (momentIndex, e) => {
        e.stopPropagation();
        if (onMomentSelect) onMomentSelect(momentIndex);
    };

    return (
        <div className="circuit-grid" onClick={() => setActiveMenu(null)} style={{ position: 'relative', minWidth: 'fit-content' }}>
            {/* Background Columns for Selection */}
            <div className="moments-background" style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '30px', // Matches .qubit-label width
                right: '40px', // Leave space for the add moment button
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
                                width: '30px', // Matches .drop-cell width
                                marginRight: '10px', // Matches .drop-cell margin-right
                                backgroundColor: isSelected ? 'rgba(66, 165, 245, 0.1)' : 'transparent',
                                borderLeft: isSelected ? '1px solid rgba(66, 165, 245, 0.3)' : '1px solid transparent',
                                borderRight: isSelected ? '1px solid rgba(66, 165, 245, 0.3)' : '1px solid transparent',
                                borderTop: '1px solid transparent',
                                borderBottom: '1px solid transparent',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                flexShrink: 0,
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

            {/* Modals */}
            {editModal.show && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Edit Gate</h3>

                        {/* Target Input */}
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

                        {/* Parameter Input */}
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

            {renameModal.show && (
                <div className="modal-overlay" onClick={closeRenameModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Rename Qubit</h3>
                        <div className="form-group">
                            <label>Name:</label>
                            <input
                                type="text"
                                value={renameModal.name}
                                onChange={e => setRenameModal({ ...renameModal, name: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') saveRename(); }}
                                autoFocus
                            />
                        </div>
                        <div className="modal-actions">
                            <button onClick={closeRenameModal} className="btn-cancel">Cancel</button>
                            <button onClick={saveRename} className="btn-save">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {controlModal.show && (
                <div className="modal-overlay" onClick={closeControlModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Add Controls</h3>
                        <div className="form-group">
                            <label>Select Control Qubits:</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '200px', overflowY: 'auto' }}>
                                {Array.from({ length: qubits }).map((_, i) => {
                                    // Disable checkbox if it's the gate's own qubit or its target
                                    const disabled =
                                        i === controlModal.gate.qubit ||
                                        (controlModal.gate.type === 'CNOT' && i === controlModal.gate.target);

                                    return (
                                        <label key={i} style={{ display: 'flex', alignItems: 'center', opacity: disabled ? 0.5 : 1 }}>
                                            <input
                                                type="checkbox"
                                                checked={controlModal.controls.includes(i)}
                                                onChange={() => toggleControl(i)}
                                                disabled={disabled}
                                            />
                                            <span style={{ marginLeft: '8px' }}>
                                                {qubitNames && qubitNames[i] ? qubitNames[i] : `Q${i}`}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button onClick={closeControlModal} className="btn-cancel">Cancel</button>
                            <button onClick={saveAddControl} className="btn-save">Save</button>
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
                                <div onClick={() => handleAction('rename')}>Rename Qubit</div>
                                <div onClick={() => handleAction('add-before')}>Add Qubit Before</div>
                                <div onClick={() => handleAction('add-after')}>Add Qubit After</div>
                                <div onClick={() => handleAction('remove')} className="danger">Remove Qubit</div>
                            </>
                        )}
                        {activeMenu.type === 'gate' && (
                            <>
                                {activeMenu.gate.type === 'CNOT' && <div onClick={() => handleAction('edit')}>Edit Target</div>}
                                {['RX', 'RY', 'RZ'].includes(activeMenu.gate.type) && <div onClick={() => handleAction('edit')}>Edit Parameter</div>}
                                <div onClick={() => handleAction('add-control')}>Add Controls</div>
                                <div onClick={() => handleAction('delete')} className="danger">Delete Gate</div>
                            </>
                        )}
                    </div>
                </>
            )}

            <div style={{ display: 'flex' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: `${GAP_SIZE}px` }}>
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
                                title={`Click to manage qubit ${qubitNames && qubitNames[qubitIndex] ? qubitNames[qubitIndex] : qubitIndex}`}
                            >
                                {qubitNames && qubitNames[qubitIndex] ?
                                    (qubitNames[qubitIndex] === `${qubitIndex}` ? `Q${qubitIndex}` : qubitNames[qubitIndex])
                                    : `Q${qubitIndex}`}
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

                    {/* Add Qubit Button below last qubit */}
                    <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '15px', marginTop: '10px' }}>
                        <button
                            onClick={() => onAddQubit(qubits - 1, 'after')}
                            style={{
                                width: '30px',
                                height: '30px',
                                minWidth: '30px',
                                minHeight: '30px',
                                padding: 0,
                                borderRadius: '50%',
                                border: '1px solid #444',
                                background: 'rgba(255,255,255,0.05)',
                                color: '#aaa',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '20px',
                                flexShrink: 0,
                                boxSizing: 'border-box'
                            }}
                            title="Add Qubit"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Add Moment Button at the end of the grid */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    paddingLeft: '10px',
                    borderLeft: '1px solid #333'
                }}>
                    <button
                        onClick={onAddMoments}
                        style={{
                            padding: '10px',
                            background: '#2d2d2d',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            cursor: 'pointer',

                            textOrientation: 'mixed',
                            height: '100px',
                            fontSize: '12px'
                        }}
                        title="Extend Circuit"
                    >
                        +
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CircuitGrid;
