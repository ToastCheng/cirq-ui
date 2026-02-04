import React, { useState, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import GatePalette from './GatePalette';
import CircuitGrid from './CircuitGrid';
import VisualizationPanel from './VisualizationPanel';
import CodePanel from './CodePanel';
import './CircuitComposer.css';

const CircuitComposer = () => {
    const [qubits, setQubits] = useState(3);
    const [gates, setGates] = useState([]); // Array of { id, type, qubit, moment, control, target }
    const [simulationResult, setSimulationResult] = useState(null);
    const [code, setCode] = useState("");

    const backendUrl = "http://127.0.0.1:8000";

    useEffect(() => {
        // Fetch simulation and code whenever circuit changes
        const fetchData = async () => {
            // Construct CircuitData payload
            const circuitData = {
                qubits,
                gates: gates.map(g => {
                    const gateObj = {
                        type: g.type,
                        qubit: g.qubit,
                        moment: g.moment
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
    }, [qubits, gates]);

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

    return (
        <DndContext onDragEnd={handleDragEnd}>
            <div className="circuit-composer">
                <div className="sidebar">
                    <GatePalette />
                    <div style={{ marginTop: '20px', color: '#888', fontSize: '12px' }}>
                        <p>Drag gates to the grid.</p>
                    </div>
                </div>
                <div className="main-area">
                    <CircuitGrid
                        qubits={qubits}
                        gates={gates}
                        setGates={setGates}
                        onAddQubit={addQubit}
                        onRemoveQubit={removeQubit}
                        onUpdateGate={updateGate}
                        onRemoveGate={removeGate}
                    />
                </div>
                <div className="visualization-area">
                    <VisualizationPanel simulationResult={simulationResult} />
                    <CodePanel code={code} />
                </div>
            </div>
        </DndContext>
    );
};

export default CircuitComposer;
