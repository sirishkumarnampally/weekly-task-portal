import Sidebar from './Sidebar';
import NissanTasksSlider from './NissanTasksSlider';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Nissan weekly tasks slider — visible to all roles */}
      <NissanTasksSlider />

      {/* Main navigation sidebar — offset to avoid slider overlap when open */}
      <div className="shrink-0 z-20 relative">
        <Sidebar />
      </div>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
