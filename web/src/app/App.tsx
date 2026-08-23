import { BrowserRouter, Route, Routes } from 'react-router-dom';

import AppShell from '../components/AppShell';
import { AuthProvider } from '../features/auth/AuthContext';
import RequireAuth from '../features/auth/RequireAuth';
import AtaquesEnVivo from '../features/live-feed/AtaquesEnVivo';
import Automatizacion from '../features/automation/Automatizacion';
import ExploradorEventos from '../features/events-explorer/ExploradorEventos';
import Login from '../features/auth/Login';
import MalwareIoc from '../features/malware/MalwareIoc';
import MapaGeografico from '../features/geo-map/MapaGeografico';
import MatrizMitre from '../features/mitre/MatrizMitre';
import Resumen from '../features/overview/Resumen';
import WorkflowsN8n from '../features/workflows/WorkflowsN8n';
import NoEncontrado from './NoEncontrado';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas fuera del shell (sin Sidebar/Header) */}
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<NoEncontrado />} />

          {/* Shell privado: Sidebar + Header + pantallas protegidas */}
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Resumen />} />
            <Route path="/live" element={<AtaquesEnVivo />} />
            <Route path="/eventos" element={<ExploradorEventos />} />
            <Route path="/mitre" element={<MatrizMitre />} />
            <Route path="/mapa" element={<MapaGeografico />} />
            <Route path="/malware" element={<MalwareIoc />} />
            <Route path="/automatizacion" element={<Automatizacion />} />
            <Route path="/workflows" element={<WorkflowsN8n />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
