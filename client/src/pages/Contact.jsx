import './Contact.css'
function Contact() {
  return (
    <section className="contact-section" id="contact">
      <div className="contact-heading">
        <p className="section-label">CONTACT US</p>

        <h2>Get in Touch with Skyrouting</h2>

        <p>
          Have questions about our aviation training programmes
          or admissions? Contact our team for further information.
        </p>
      </div>

      <div className="contact-grid">
        <div className="contact-card">
          <h3>Our Address</h3>
          <p>
            Skyrouting House, Gate 1,
            Nnamdi Azikiwe International Airport,
            Abuja, Nigeria.
          </p>
        </div>

        <div className="contact-card">
          <h3>Telephone Numbers</h3>
          <p>
            <a href="tel:+2348063604567">+234 806 360 4567</a>
          </p>
          <p>
            <a href="tel:+2348062893724">+234 806 289 3724</a>
          </p>
          <p>
            <a href="tel:+2348033138999">+234 803 313 8999</a>
          </p>
        </div>

        <div className="contact-card">
          <h3>Email Addresses</h3>
          <p>
            <a href="mailto:sats@skyrouting.com">
              sats@skyrouting.com
            </a>
          </p>
          <p>
            <a href="mailto:info.sats@skyrouting.com">
              info.sats@skyrouting.com
            </a>
          </p>
          <p>
            <a href="mailto:admission.sats@skyrouting.com">
              admission.sats@skyrouting.com
            </a>
          </p>
          <p>
            <a href="mailto:ops@skyrouting.com">
              ops@skyrouting.com
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}

export default Contact