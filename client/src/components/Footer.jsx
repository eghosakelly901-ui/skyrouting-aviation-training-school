import './Footer.css'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <div className="footer-logo-wrap">
            <img
              src="/images/skyrouting-logo.webp"
              alt="Skyrouting Aviation Training School Ltd/GTE"
              className="footer-logo"
            />
          </div>
        </div>

        <div className="footer-links">
          <h3>Quick Links</h3>
          <a href="#home">Home</a>
          <a href="#about">About Us</a>
          <a href="#courses">Our Courses</a>
          <a href="#admissions">Admissions</a>
          <a href="#contact">Contact Us</a>
        </div>

        <div className="footer-contact">
          <h3>Contact Information</h3>
          <p>Abuja, Nigeria</p>
          <a href="mailto:info.sats@skyrouting.com">
            info.sats@skyrouting.com
          </a>
          <a href="tel:+2348063604567">
            +234 806 360 4567
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        <p>
          © {new Date().getFullYear()} Skyrouting Aviation Training
          School Ltd/GTE. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

export default Footer