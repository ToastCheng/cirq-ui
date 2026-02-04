import React from 'react';

const BlochSphere = ({ vector, label }) => {
    // vector is [x, y, z]
    // Simple 3D projection
    const r = 40;
    const cx = 50;
    const cy = 50;

    // We visualize looking at the sphere. 
    // Let's draw the circle for outline.
    // The vector tip:
    // We can map x -> x-axis on screen
    // z -> y-axis on screen (negative)
    // y -> depth (size modification?)

    // Standard Bloch sphere mapping usually puts Z on vertical axis.
    // X on horizontal.
    // Y is depth.

    // x_screen = cx + x * r
    // y_screen = cy - z * r  (Up is +Z)

    // Let's ignore Y depth for simple 2D projection or draw a perspective line.

    const x = vector[0];
    const y = vector[1];
    const z = vector[2];

    const tipX = cx + x * r;
    const tipY = cy - z * r;

    return (
        <div className="bloch-sphere" style={{ textAlign: 'center', margin: '10px' }}>
            <svg width="100" height="100">
                {/* Sphere outline */}
                <circle cx={cx} cy={cy} r={r} stroke="#777" strokeWidth="1" fill="none" />

                {/* Axes */}
                <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="#444" strokeDasharray="2,2" />
                <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#444" strokeDasharray="2,2" />

                {/* Vector */}
                <line x1={cx} y1={cy} x2={tipX} y2={tipY} stroke="#FF5722" strokeWidth="3" />
                <circle cx={tipX} cy={tipY} r="3" fill="#FF5722" />

                {/* Labels */}
                <text x={cx} y={cy - r - 5} fill="#aaa" fontSize="10" textAnchor="middle">|0⟩</text>
                <text x={cx} y={cy + r + 10} fill="#aaa" fontSize="10" textAnchor="middle">|1⟩</text>
            </svg>
            <div style={{ fontSize: '10px', color: '#ccc' }}>{label}</div>
            <div style={{ fontSize: '8px', color: '#888' }}>
                X:{x.toFixed(2)} Y:{y.toFixed(2)} Z:{z.toFixed(2)}
            </div>
        </div>
    );
};

const VisualizationPanel = ({ simulationResult }) => {
    if (!simulationResult) return <div style={{ color: '#888' }}>Run simulation to see results...</div>;

    return (
        <div className="viz-panel">
            <h4>Bloch Spheres</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                {simulationResult.bloch_vectors.map((vec, i) => (
                    <BlochSphere key={i} vector={vec} label={`Q${i}`} />
                ))}
            </div>

            <h4>State Vector</h4>
            <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#bbb', marginBottom: '20px' }}>
                {simulationResult.state_vector.map((amp, i) => {
                    const mag = Math.sqrt(amp.real ** 2 + amp.imag ** 2);
                    if (mag < 0.001) return null; // Hide zero amplitudes
                    const sign = amp.imag >= 0 ? '+' : '-';
                    return (
                        <div key={i}>
                            |{i.toString(2).padStart(Math.round(Math.log2(simulationResult.state_vector.length)), '0')}⟩: {amp.real.toFixed(4)} {sign} {Math.abs(amp.imag).toFixed(4)}j
                        </div>
                    );
                })}
            </div>

            <h4>Amplitudes</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {simulationResult.state_vector.map((amp, i) => {
                    // Calculate probability (amplitude squared)
                    const prob = amp.real ** 2 + amp.imag ** 2;
                    // Format label |00..>
                    const label = `|${i.toString(2).padStart(Math.round(Math.log2(simulationResult.state_vector.length)), '0')}⟩`;

                    return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#ccc' }}>
                            <div style={{ width: '40px', fontFamily: 'monospace' }}>{label}</div>
                            <div style={{ flex: 1, backgroundColor: '#333', height: '10px', borderRadius: '2px', overflow: 'hidden', marginRight: '10px' }}>
                                <div style={{
                                    width: `${prob * 100}%`,
                                    backgroundColor: '#42A5F5',
                                    height: '100%',
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                            <div style={{ width: '40px', textAlign: 'right' }}>{(prob * 100).toFixed(1)}%</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default VisualizationPanel;
