import { BrowserRouter, Route, Routes } from 'react-router-dom';

import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
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
import NoEncontrado from './NoEncontrado';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-shell">
          <Sidebar />
          <div className="app-main">
            <Header />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <Resumen />
                  </RequireAuth>
                }
              />
              <Route
                path="/live"
                element={
                  <RequireAuth>
                    <AtaquesEnVivo />
                  </RequireAuth>
                }
              />
              <Route
                path="/eventos"
                element={
                  <RequireAuth>
                    <ExploradorEventos />
                  </RequireAuth>
                }
              />
              <Route
                path="/mitre"
                element={
                  <RequireAuth>
                    <MatrizMitre />
                  </RequireAuth>
                }
              />
              <Route
                path="/mapa"
                element={
                  <RequireAuth>
                    <MapaGeografico />
                  </RequireAuth>
                }
              />
              <Route
                path="/malware"
                element={
                  <RequireAuth>
                    <MalwareIoc />
                  </RequireAuth>
                }
              />
              <Route
                path="/automatizacion"
                element={
                  <RequireAuth>
                    <Automatizacion />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NoEncontrado />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
