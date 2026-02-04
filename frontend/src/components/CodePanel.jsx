import React from 'react';

const CodePanel = ({ code }) => {
    // code prop is now expected to be an object { diagram: string, source_code: string }
    // but initially it might be null or loading.

    // Fallback if code is string (backward compatibility or initial state)
    const isObject = typeof code === 'object' && code !== null;
    const diagram = isObject ? code.diagram : code;
    const sourceCode = isObject ? code.source_code : "";

    const [activeTab, setActiveTab] = React.useState('diagram');

    return (
        <div className="code-panel" style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '10px' }}>
            <div className="tabs" style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <button
                    onClick={() => setActiveTab('diagram')}
                    style={{
                        background: activeTab === 'diagram' ? '#007acc' : '#333',
                        color: 'white',
                        border: 'none',
                        padding: '5px 10px',
                        cursor: 'pointer',
                        borderRadius: '3px'
                    }}
                >
                    Diagram
                </button>
                <button
                    onClick={() => setActiveTab('source')}
                    style={{
                        background: activeTab === 'source' ? '#007acc' : '#333',
                        color: 'white',
                        border: 'none',
                        padding: '5px 10px',
                        cursor: 'pointer',
                        borderRadius: '3px'
                    }}
                >
                    Source Code
                </button>
            </div>

            <pre style={{
                backgroundColor: '#111',
                padding: '10px',
                borderRadius: '5px',
                overflowX: 'auto',
                fontSize: '12px',
                color: activeTab === 'source' ? '#9CDCFE' : '#4EC9B0', // VSCode-like colors
                textAlign: 'left',
                fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace'
            }}>
                {activeTab === 'diagram' ? (diagram || "# Generating diagram...") : (sourceCode || "# Generating source...")}
            </pre>
        </div>
    );
};

export default CodePanel;
