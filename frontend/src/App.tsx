import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import Academy from './pages/Academy'
import Simulator from './pages/Simulator'
import Calculator from './pages/Calculator'
import TradingGame from './pages/TradingGame'
import Scanner from './pages/Scanner'
import Positions from './pages/Positions'
import Roadmap from './pages/Roadmap'

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950">
        <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-2 sm:gap-6">
            <div className="flex items-center gap-2 mr-4">
              <span className="text-2xl">📈</span>
              <span className="font-bold text-white text-lg hidden sm:block">Академия опционов</span>
            </div>
            <nav className="flex items-center gap-1">
              <NavItem to="/academy" label="Академия" />
              <NavItem to="/simulator" label="Симулятор" />
              <NavItem to="/calculator" label="Калькулятор" />
              <NavItem to="/game" label="🎮 Игра" />
              <NavItem to="/scanner" label="📡 Сканер" />
              <NavItem to="/positions" label="📋 Позиции" />
              <NavItem to="/roadmap" label="🗺️ Путь" />
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/academy" replace />} />
            <Route path="/academy" element={<Academy />} />
            <Route path="/academy/:lessonId" element={<Academy />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/calculator" element={<Calculator />} />
            <Route path="/game" element={<TradingGame />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/positions" element={<Positions />} />
            <Route path="/roadmap" element={<Roadmap />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
