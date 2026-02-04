import React from 'react';
import { useDraggable } from '@dnd-kit/core';

const DraggableGate = ({ type }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: type,
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`gate gate-${type}`}
        >
            {type}
        </div>
    );
};

const GatePalette = () => {
    const gates = ['H', 'X', 'Y', 'Z', 'RX', 'RY', 'RZ', 'CNOT'];

    return (
        <div className="gate-palette">
            <h3>Gates</h3>
            <div className="gate-list">
                {gates.map(gate => (
                    <DraggableGate key={gate} type={gate} />
                ))}
            </div>
        </div>
    );
};

export default GatePalette;
