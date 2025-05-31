import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Typography,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import './employeesPage.scss';

interface Employee {
  id: number;
  name: string;
  title: string;
  location: string;
  avatar: string;
  subType?: string;
  children?: Employee[];
}

// Initial data from org chart
const initialData: Employee[] = [
  {
    id: 1,
    name: 'Bilel AYACHI',
    title: 'Departement Froid et climatisation',
    location: 'TUN Tunis - Extension',
    avatar: 'https://randomuser.me/api/portraits/men/61.jpg',
    children: [
      {
        id: 2,
        name: 'BALU MAVINGA Jean',
        title: 'Chef de service Chargé de clim-domestique',
        subType: 'UTEX',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/62.jpg',
      },
      {
        id: 3,
        name: 'IKALABA NKOSI Louison',
        title: 'Chef de service Chargé de clim-domestique',
        subType: 'UTEX',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/63.jpg',
      },
      {
        id: 4,
        name: 'MATALATALA WISAMAU Richard',
        title: 'Chef de service Chargé de clim-domestique',
        subType: 'UTEX',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/64.jpg',
      },
      {
        id: 5,
        name: 'MBENZA VUAMISA Willy',
        title: 'Chef de service Chargé de clim-domestique',
        subType: 'SNEL',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/65.jpg',
      },
      {
        id: 6,
        name: 'MFIKA MFUNDU KIMPEMBE Roc',
        title: 'Chef de service Chargé de clim-domestique',
        subType: 'UTEX',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/66.jpg',
      },
      {
        id: 7,
        name: 'TOKO ZABANA Juvénal',
        title: 'Chef de service Chargé de clim-domestique',
        subType: 'UTEX',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/67.jpg',
      },
      {
        id: 8,
        name: 'KAKUTALUA NGUVU Bienvenu',
        title: 'Polyvalent',
        subType: 'POLIVALONT',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/68.jpg',
      },
      {
        id: 9,
        name: 'KAMAKAMA MBALA Joseph',
        title: 'Polyvalent',
        subType: 'POLIVALONT',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/69.jpg',
      },
      {
        id: 10,
        name: 'KUMBANA MOYO Beckers',
        title: 'Polyvalent',
        subType: 'POLIVALONT',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/70.jpg',
      },
      {
        id: 11,
        name: 'LUVUALU Thomas',
        title: 'Polyvalent',
        subType: 'POLIVALONT',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/71.jpg',
      },
      {
        id: 12,
        name: 'MENANKUTIMA NSOMI Marc',
        title: 'Polyvalent',
        subType: 'POLIVALONT',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/72.jpg',
      },
      {
        id: 13,
        name: 'MOBATUE MBEMBA Rigaen',
        title: 'Polyvalent',
        subType: 'POLIVALONT',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/73.jpg',
      },
      {
        id: 14,
        name: 'DIANABO KALIMUNDA Marius',
        title: 'Chef de service adj chargé du climatisation centralisé',
        subType: 'PULLMAN',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/74.jpg',
      },
      {
        id: 15,
        name: 'MALONGA KUAMA Isidore',
        title: 'Chef de service adj chargé du climatisation centralisé',
        subType: 'PULLMAN',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/75.jpg',
      },
      {
        id: 16,
        name: 'MBIYAVANGA MATALA Antoine',
        title: 'Chef de service adj chargé du climatisation centralisé',
        subType: 'PULLMAN',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/76.jpg',
      },
      {
        id: 17,
        name: 'MUSOMONI KAFUTI Trésor-Benjamin',
        title: 'Chef de service adj chargé du climatisation centralisé',
        subType: 'BCDC',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/77.jpg',
      },
      {
        id: 18,
        name: 'NDOMBASI NGOMBO Diego',
        title: 'Chef de service adj chargé du climatisation centralisé',
        subType: 'BCDC',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/78.jpg',
      },
      {
        id: 19,
        name: 'NTOTO PHUATI Sylvain',
        title: 'Chef de service adj chargé du climatisation centralisé',
        subType: 'BCDC',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/79.jpg',
      },
      {
        id: 20,
        name: 'SADI TONDASE Dodo',
        title: 'Chef de service adj chargé du climatisation centralisé',
        subType: 'BCDC',
        location: 'TUN Tunis - Extension',
        avatar: 'https://randomuser.me/api/portraits/men/80.jpg',
      },
    ],
  },
];

const EmployeesPage = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<Partial<Employee>>({
    name: '',
    title: '',
    location: '',
    subType: '',
  });

  // Function to get all employees recursively
  const getAllEmployees = (data: Employee[]): Employee[] => {
    return data.reduce((acc: Employee[], employee) => {
      const { children, ...employeeWithoutChildren } = employee;
      acc.push(employeeWithoutChildren);
      if (children) {
        acc.push(...getAllEmployees(children));
      }
      return acc;
    }, []);
  };

  useEffect(() => {
    // Initialize employees with all employees from the org chart
    const allEmployees = getAllEmployees(initialData);
    setEmployees(allEmployees);
  }, []);

  const handleOpenDialog = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData(employee);
    } else {
      setEditingEmployee(null);
      setFormData({
        name: '',
        title: '',
        location: '',
        subType: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingEmployee(null);
    setFormData({
      name: '',
      title: '',
      location: '',
      subType: '',
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = () => {
    if (editingEmployee) {
      // Update existing employee
      setEmployees(prev =>
        prev.map(emp =>
          emp.id === editingEmployee.id ? { ...emp, ...formData } : emp
        )
      );
    } else {
      // Add new employee
      const newEmployee: Employee = {
        ...formData as Employee,
        id: Date.now(), // Temporary ID generation
        avatar: 'https://randomuser.me/api/portraits/men/1.jpg', // Default avatar
      };
      setEmployees(prev => [...prev, newEmployee]);
    }
    handleCloseDialog();
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      setEmployees(prev => prev.filter(emp => emp.id !== id));
    }
  };

  return (
    <div className="employees-container">
      <AppBar position="static" color="primary">
        <Toolbar>
          <Button color="inherit" onClick={() => navigate('/org-chart')}>
            Back to Org Chart
          </Button>
          <Typography variant="h6" style={{ marginLeft: '20px' }}>
            Employees Management
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ mb: 2 }}
        >
          Add Employee
        </Button>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Avatar</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Sub Type</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <img
                      src={employee.avatar}
                      alt={employee.name}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover'
                      }}
                    />
                  </TableCell>
                  <TableCell>{employee.name}</TableCell>
                  <TableCell>{employee.title}</TableCell>
                  <TableCell>{employee.location}</TableCell>
                  <TableCell>{employee.subType}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleOpenDialog(employee)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(employee.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>
          {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              name="name"
              label="Name"
              value={formData.name}
              onChange={handleInputChange}
              fullWidth
            />
            <TextField
              name="title"
              label="Title"
              value={formData.title}
              onChange={handleInputChange}
              fullWidth
            />
            <TextField
              name="location"
              label="Location"
              value={formData.location}
              onChange={handleInputChange}
              fullWidth
            />
            <TextField
              name="subType"
              label="Sub Type"
              value={formData.subType}
              onChange={handleInputChange}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {editingEmployee ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default EmployeesPage;