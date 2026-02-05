import React, { useState, useEffect } from 'react';
import { DndContext } from '@dnd-kit/core';
import GatePalette from './GatePalette';
import CircuitGrid from './CircuitGrid';
import { BlochSpherePanel, StateVisualizationPanel } from './VisualizationPanel';
import CodePanel from './CodePanel';
import './CircuitComposer.css';

const CircuitComposer = () => {
    const [qubits, setQubits] = useState(3);
    const [momentCount, setMomentCount] = useState(10); // Dynamic moment length
    const [qubitNames, setQubitNames] = useState(['0', '1', '2']); // Initialize defaults
    const [gates, setGates] = useState([]);
    const [simulationResult, setSimulationResult] = useState(null);
    const [code, setCode] = useState("");
    const [selectedMoment, setSelectedMoment] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false); // Track if initial load is complete

    const backendUrl = "http://127.0.0.1:8000";

    // Load from URL snapshot on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const snapshot = params.get('snapshot');

        if (snapshot) {
            try {
                // Decode base64
                const jsonStr = atob(snapshot);
                const data = JSON.parse(jsonStr);

                // Restore state
                if (data.qubits) setQubits(data.qubits);
                if (data.qubitNames) setQubitNames(data.qubitNames);
                if (data.gates) setGates(data.gates);
                if (data.momentCount) setMomentCount(data.momentCount);

            } catch (e) {
                console.error("Failed to parse snapshot:", e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Update URL snapshot on state change
    useEffect(() => {
        if (!isLoaded) return; // Don't overwrite URL during initial load

        const state = {
            qubits,
            qubitNames,
            gates,
            momentCount
        };

        const jsonStr = JSON.stringify(state);
        const base64 = btoa(jsonStr);

        // Update URL without reloading
        const url = new URL(window.location);
        url.searchParams.set('snapshot', base64);
        window.history.replaceState({}, '', url);

    }, [qubits, qubitNames, gates, momentCount, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;

        // Fetch simulation and code whenever circuit changes
        const fetchData = async () => {
            // Construct CircuitData payload
            const circuitData = {
                qubits,
                qubit_names: qubitNames,
                gates: gates.map(g => {
                    const gateObj = {
                        type: g.type,
                        qubit: g.qubit,
                        moment: g.moment,
                        controls: g.controls // Pass generic controls if present
                    };

                    if (g.type === 'CNOT') {
                        // Use explicit control/target if set, otherwise default logic
                        gateObj.control = g.control !== undefined ? g.control : g.qubit;
                        // Default target: qubit + 1 (wrapping) if not explicit
                        gateObj.target = g.target !== undefined ? g.target : (g.qubit + 1) % qubits;
                    }

                    if (['RX', 'RY', 'RZ'].includes(g.type)) {
                        gateObj.parameter = g.parameter;
                    }
                    return gateObj;
                })
            };

            try {
                // Simulation
                const simRes = await fetch(`${backendUrl}/simulate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(circuitData)
                });
                if (simRes.ok) {
                    const data = await simRes.json();
                    setSimulationResult(data);
                }

                // Code
                const codeRes = await fetch(`${backendUrl}/code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(circuitData)
                });
                if (codeRes.ok) {
                    const data = await codeRes.json();
                    setCode(data); // data is { diagram, source_code }
                }

            } catch (e) {
                console.error("Backend error:", e);
            }
        };

        fetchData();
    }, [qubits, gates, qubitNames]);

    // ... (displayResult logic unchanged)

    // Derive the result to display based on selection
    const displayResult = React.useMemo(() => {
        if (!simulationResult) return null;
        if (selectedMoment !== null && simulationResult.steps) {
            // Find step for this moment
            const step = simulationResult.steps.find(s => s.moment === selectedMoment);
            if (step) {
                return {
                    state_vector: step.state_vector,
                    bloch_vectors: step.bloch_vectors
                };
            }
        }
        return simulationResult;
    }, [simulationResult, selectedMoment]);

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (over) {
            // Parse drop target ID: "moment-qubit"
            const [momentStr, qubitStr] = over.id.split('-');
            const moment = parseInt(momentStr);
            const qubit = parseInt(qubitStr);
            const gateType = active.id;

            // Add gate to state
            setGates((prev) => {
                // Check if spot is occupied
                const existing = prev.find(g => g.moment === moment && g.qubit === qubit);
                if (existing) {
                    // Replace 
                    return prev.map(g => (g.moment === moment && g.qubit === qubit) ?
                        { ...g, id: `${gateType}-${Date.now()}`, type: gateType } : g);
                }
                return [
                    ...prev,
                    { id: `${gateType}-${Date.now()}`, type: gateType, qubit, moment }
                ];
            });
        }
    };

    const updateGate = (id, newProps) => {
        setGates(prev => prev.map(g => g.id === id ? { ...g, ...newProps } : g));
    };

    const removeGate = (id) => {
        setGates(prev => prev.filter(g => g.id !== id));
    };

    const addQubit = (targetIndex, position) => {
        // position: 'before' or 'after'
        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;

        setQubits(prev => prev + 1);

        // Add new name at insertIndex
        setQubitNames(prev => {
            const next = [...prev];
            // Default name for new qubit: find next integer not in use or just append?
            // Simple default: string of index. Wait, indices shift.
            // Let's us "q{N}" but we might have duplicates if we just append.
            // Safe default: just string(prev.length)
            next.splice(insertIndex, 0, `${prev.length}`);
            return next;
        });

        setGates(prev => prev.map(g => {
            let newG = { ...g };
            if (newG.qubit >= insertIndex) {
                newG.qubit += 1;
            }
            // Shift control/target if they exist and are >= insertIndex
            if (newG.control !== undefined && newG.control >= insertIndex) newG.control += 1;
            if (newG.target !== undefined && newG.target >= insertIndex) newG.target += 1;

            return newG;
        }));
    };

    const removeQubit = (targetIndex) => {
        if (qubits <= 1) return; // Prevent removing the last qubit

        setQubits(prev => prev - 1);
        setQubitNames(prev => prev.filter((_, i) => i !== targetIndex));

        setGates(prev => {
            // Remove gates on the deleted qubit (either as primary, control, or target)
            const filtered = prev.filter(g =>
                g.qubit !== targetIndex &&
                (g.control === undefined || g.control !== targetIndex) &&
                (g.target === undefined || g.target !== targetIndex)
            );

            // Shift gates after the deleted qubit
            return filtered.map(g => {
                let newG = { ...g };
                if (newG.qubit > targetIndex) newG.qubit -= 1;
                if (newG.control !== undefined && newG.control > targetIndex) newG.control -= 1;
                if (newG.target !== undefined && newG.target > targetIndex) newG.target -= 1;
                return newG;
            });
        });
    };

    const handleRenameQubit = (index, newName) => {
        setQubitNames(prev => {
            const next = [...prev];
            next[index] = newName;
            return next;
        });
    };

    const [showResetModal, setShowResetModal] = useState(false);

    const handleMomentSelect = (momentIndex) => {
        setSelectedMoment(prev => prev === momentIndex ? null : momentIndex);
    };

    const requestReset = () => {
        setShowResetModal(true);
    };

    const confirmReset = () => {
        setQubits(3);
        setQubitNames(['0', '1', '2']);
        setGates([]);
        setMomentCount(10);
        setSimulationResult(null);
        setCode("");
        setSelectedMoment(null);

        // Clear URL snapshot
        const url = new URL(window.location.search, window.location.origin);
        url.searchParams.delete('snapshot');
        window.history.replaceState({}, '', url); // Use replaceState to update URL without reload and with correct path

        setShowResetModal(false);
    };

    const closeResetModal = () => {
        setShowResetModal(false);
    };

    return (
        <DndContext onDragEnd={handleDragEnd}>
            <div className="circuit-composer" onClick={() => setSelectedMoment(null)} style={{ position: 'relative' }}>
                <div className="sidebar" onClick={e => e.stopPropagation()}>
                    <GatePalette />
                    <div style={{ marginTop: '20px', color: '#888', fontSize: '12px' }}>
                        <p>Drag gates to the grid.</p>
                        <p>Click moment column to inspect state.</p>
                    </div>
                </div>
                <div className="main-area" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    <button
                        onClick={requestReset}
                        style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            zIndex: 100,
                            padding: '6px 12px',
                            backgroundColor: '#d32f2f',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '12px'
                        }}
                    >
                        Reset
                    </button>

                    <div style={{ flex: 1, overflowX: 'auto', marginTop: '10px', marginBottom: '20px' }}>
                        <CircuitGrid
                            qubits={qubits}
                            momentCount={momentCount}
                            qubitNames={qubitNames}
                            gates={gates}
                            setGates={setGates}
                            onAddQubit={addQubit}
                            onRemoveQubit={removeQubit}
                            onRenameQubit={handleRenameQubit}
                            onUpdateGate={updateGate}
                            onRemoveGate={removeGate}
                            selectedMoment={selectedMoment}
                            onMomentSelect={handleMomentSelect}
                            onAddMoments={() => setMomentCount(prev => prev + 3)}
                        />
                    </div>
                    <div style={{ borderTop: '1px solid #3e3e3e', paddingTop: '10px' }}>
                        <BlochSpherePanel simulationResult={displayResult} />
                    </div>
                </div>
                <div className="visualization-area" onClick={e => e.stopPropagation()}>
                    <StateVisualizationPanel simulationResult={displayResult} />
                    <CodePanel code={code} />
                </div>

                {/* Reset Confirmation Modal */}
                {showResetModal && (
                    <div className="modal-overlay" onClick={closeResetModal}>
                        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: '300px' }}>
                            <h3 style={{ marginTop: 0 }}>Confirm Reset</h3>
                            <p style={{ color: '#ccc', marginBottom: '20px' }}>
                                Are you sure you want to reset the circuit?
                            </p>
                            <div className="modal-actions">
                                <button onClick={closeResetModal} className="btn-cancel">Cancel</button>
                                <button onClick={confirmReset} className="btn-save" style={{ backgroundColor: '#d32f2f' }}>Reset</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DndContext>
    );
};

export default CircuitComposer;
