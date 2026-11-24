import './Header.css'

function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#home" aria-label="Skyrouting home">
        <img
          src="/images/skyrouting-logo.webp"
          alt="Skyrouting Aviation Training School Ltd/GTE"
          className="brand-logo"
        />
      </a>

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