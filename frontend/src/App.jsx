import React from 'react';
import './App.css';
import CircuitComposer from './components/CircuitComposer';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Cirq Web Composer</h1>
      </header>
      <main>
        <CircuitComposer />
      </main>
    </div>
  );
}

export default App;
