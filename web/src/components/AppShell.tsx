import { Outlet } from 'react-router-dom';

import Header from './Header';
import Sidebar from './Sidebar';

/** Layout privado del SOC: Sidebar + Header + pantalla activa. */
export default function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Header />
        <Outlet />
      </div>
    </div>
  );
}
