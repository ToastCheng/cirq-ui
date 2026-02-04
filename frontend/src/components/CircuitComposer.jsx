import React, { useState, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import GatePalette from './GatePalette';
import CircuitGrid from './CircuitGrid';
import VisualizationPanel from './VisualizationPanel';
import CodePanel from './CodePanel';
import './CircuitComposer.css';

const Wrapper = ({ children }) => (
    <div className="circuit-composer-wrapper">
        {children}
    </div>
);

const CircuitComposer = () => {
    const [qubits, setQubits] = useState(3);
    const [gates, setGates] = useState([]); // Array of { id, type, qubit, moment }
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
                    // Simple CNOT handling: if it's CNOT, assuming target is next qubit
                    if (g.type === 'CNOT') {
                        gateObj.control = g.qubit;
                        // Ensure target is valid
                        gateObj.target = (g.qubit + 1) % qubits;
                        // If target == control (e.g. 1 qubit total), this is invalid, but let's ignore for now.
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
                    setCode(data.code);
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

    const addQubit = (targetIndex, position) => {
        // position: 'before' or 'after'
        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;

        setQubits(prev => prev + 1);

        setGates(prev => prev.map(g => {
            if (g.qubit >= insertIndex) {
                return { ...g, qubit: g.qubit + 1 };
            }
            return g;
        }));
    };

    const removeQubit = (targetIndex) => {
        if (qubits <= 1) return; // Prevent removing the last qubit

        setQubits(prev => prev - 1);

        setGates(prev => {
            // Remove gates on the deleted qubit
            const filtered = prev.filter(g => g.qubit !== targetIndex);
            // Shift gates after the deleted qubit
            return filtered.map(g => {
                if (g.qubit > targetIndex) {
                    return { ...g, qubit: g.qubit - 1 };
                }
                return g;
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
