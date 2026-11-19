import './Admissions.css'
function Admissions() {
  return (
    <section className="admissions-section" id="admissions">
      <div className="admissions-content">
        <p className="section-label">ADMISSIONS</p>

        <h2>Start Your Journey into Aviation</h2>

        <p>
          Take the next step towards your aviation career
          with Skyrouting Aviation Training School Ltd/GTE.
          Explore our training programmes and contact our
          admissions team for application information.
        </p>

        <div className="admissions-buttons">
          <a
            href="mailto:admission.sats@skyrouting.com"
            className="admissions-primary-button"
          >
            Contact Admissions
          </a>

          <a
            href="tel:+2348063604567"
            className="admissions-secondary-button"
          >
            Call Admissions
          </a>
        </div>

        <p className="admissions-note">
          TRAIN • PREPARE • TAKE OFF
        </p>
      </div>
    </section>
  )
}

export default Admissions