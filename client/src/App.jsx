import { Routes, Route, Navigate } from 'react-router'

import Header from './components/Header.jsx'
import Home from './pages/Home.jsx'
import Courses from './components/Courses.jsx'
import About from './pages/About.jsx'
import Admissions from './pages/Admissions.jsx'
import PaidAdmission from './pages/PaidAdmission.jsx'
import Contact from './pages/Contact.jsx'
import Footer from './components/Footer.jsx'
import News from './pages/News.jsx'
import ApplicationForm from './components/ApplicationForm.jsx'

import AdminLogin from './admin/AdminLogin.jsx'
import AdminDashboard from './admin/AdminDashboard.jsx'

function PublicWebsite() {
  return (
    <>
      <Header />
      <Home />
      <About />
      <Courses />
      <News />
      <Admissions />
      <ApplicationForm />
      <Contact />
      <Footer />
    </>
  )
}

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<PublicWebsite />}
      />

      <Route
        path="/admin/login"
        element={<AdminLogin />}
      />
<Route
  path="/admissions/apply"
  element={<PaidAdmission />}
/>

      <Route
        path="/admin/dashboard"
        element={<AdminDashboard />}
      />

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  )
}

export default App