import React from 'react';

const CodePanel = ({ code }) => {
    return (
        <div className="code-panel" style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '10px' }}>
            <h4>Cirq Code</h4>
            <pre style={{
                backgroundColor: '#111',
                padding: '10px',
                borderRadius: '5px',
                overflowX: 'auto',
                fontSize: '12px',
                color: '#4EC9B0'
            }}>
                {code || "# Generating code..."}
            </pre>
        </div>
    );
};

export default CodePanel;
