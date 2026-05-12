import { NavLink } from 'react-router-dom';

const links = [
  { to: '/',        label: 'Map',     ico: '🗺️' },
  { to: '/squads',  label: 'Squads',  ico: '👥' },
  { to: '/places',  label: 'Places',  ico: '📍' },
  { to: '/badges',  label: 'Badges',  ico: '🏆' },
  { to: '/profile', label: 'Me',      ico: '🙂' }
];

export default function NavBar() {
  return (
    <nav className="nav">
      {links.map(l => (
        <NavLink key={l.to} to={l.to} end className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="ico" aria-hidden>{l.ico}</span>
          <span>{l.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
