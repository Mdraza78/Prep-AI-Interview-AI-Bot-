import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Components/Login';
import Test from './Components/Test';
import Register from './Components/Register';
import Dashboard from './Components/Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" />} />
        <Route path="/dashboard" element={<Dashboard />}/>
        <Route path="/test" element={<Test />}/>
      </Routes>
    </BrowserRouter>
  );
}
