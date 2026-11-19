import './Header.css'
function Header() {
  return (
    <header className="site-header">
      <div className="brand">
        <div className="brand-text">
          <span className="brand-name">SKYROUTING</span>
          <span className="brand-subtitle">
            AVIATION TRAINING SCHOOL LTD/GTE
          </span>
          <span className="brand-tagline">
            TRAIN • PREPARE • TAKE OFF
          </span>
        </div>
      </div>

      <nav className="main-navigation" aria-label="Main navigation">
        <a href="#home">Home</a>
        <a href="#about">About</a>
        <a href="#courses">Courses</a>
        <a href="#admissions">Admissions</a>
        <a href="#news">News</a>
        <a href="#contact">Contact</a>
      </nav>
    </header>
  )
}

export default Header