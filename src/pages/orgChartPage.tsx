import React from 'react';
import { AppBar, Toolbar, Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import './orgChartPage.scss';

const employees = [
  {
    id: 1,
    name: 'Mootaz Ayadi',
    title: 'Team Leader, Operations',
    location: 'TUN Tunis - Extension',
    avatar: 'https://randomuser.me/api/portraits/men/41.jpg',
    children: [
      {
        id: 2,
        name: 'Ahmed Cherni',
        title: 'Advisor I, Technical Support',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/42.jpg',
      },
      {
        id: 3,
        name: 'Ahmed Tabbabi',
        title: 'Advisor I, Technical Support',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/43.jpg',
      },
      {
        id: 4,
        name: 'Belhassen Barouta',
        title: 'Advisor I, Technical Support',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/44.jpg',
      },
      {
        id: 5,
        name: 'Chadha Dridi',
        title: 'Advisor I, Technical Support',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/women/45.jpg',
      },
      {
        id: 6,
        name: 'Oussema Ouchikh',
        title: 'Advisor I, Customer Service',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/46.jpg',
      },
      {
        id: 7,
        name: 'Henda Zeddini',
        title: 'Advisor I, Technical Support',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/women/47.jpg',
      },
      {
        id: 8,
        name: 'Houssem Ben Ishak',
        title: 'Advisor I, Technical Support',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/48.jpg',
      },
      {
        id: 9,
        name: 'Houssem Ben Said',
        title: 'Advisor I, Technical Support',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/49.jpg',
      },
      {
        id: 10,
        name: 'Ibtissem Gharbi',
        title: 'Advisor I, Technical Support',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/women/50.jpg',
      },
    ],
  },
];

const OrgChartPage = () => {
  const leader = employees[0];
  const navigate = useNavigate();
  const isAdmin = localStorage.getItem('role') === 'admin';

  return (
    <div className="orgchart-container">
      <AppBar position="static" color="primary" className="orgchart-app-bar">
        <Toolbar className="orgchart-toolbar">
          <Button color="inherit" onClick={() => navigate('/home')} className="orgchart-nav-btn">
            Back to Home
          </Button>
          <Button color="inherit" disabled className="orgchart-nav-btn">
            Profile
          </Button>
          {isAdmin && (
            <Button color="inherit" disabled className="orgchart-nav-btn">
              Edit Employee
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <div className="orgchart-leader">
        <div className="orgchart-card leader">
          <img src={leader.avatar} alt={leader.name} className="orgchart-avatar leader" />
          <div className="orgchart-name leader">{leader.name}</div>
          <div className="orgchart-title leader">{leader.title}</div>
          <div className="orgchart-location leader">{leader.location}</div>
        </div>
      </div>
      <div className="orgchart-line" />
      <div className="orgchart-advisors">
        {leader.children.map((advisor) => (
          <div className="orgchart-card advisor" key={advisor.id}>
            <img src={advisor.avatar} alt={advisor.name} className="orgchart-avatar" />
            <div className="orgchart-name">{advisor.name}</div>
            <div className="orgchart-title">{advisor.title}</div>
            <div className="orgchart-location">{advisor.location}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrgChartPage;