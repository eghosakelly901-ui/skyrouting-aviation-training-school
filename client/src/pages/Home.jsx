import './Home.css'
function Home() {
  return (
    <main>
      <section className="hero-section" id="home">
        <div className="hero-content">
          <p className="hero-label">
            AVIATION TRAINING SCHOOL · ABUJA, NIGERIA
          </p>

          <h1>
            Prepare for Your
            <span> Future in Aviation</span>
          </h1>

          <p className="hero-description">
            Discover aviation training opportunities at
            Skyrouting Aviation Training School. Explore our
            courses and take the next step towards your aviation career.
          </p>

          <div className="hero-buttons">
            <a href="#courses" className="primary-button">
              Explore Our Courses
            </a>

            <a href="/admissions/apply" className="secondary-button">
 		 Apply for Admission
	</a>
          </div>

          <p className="hero-tagline">
            TRAIN • PREPARE • TAKE OFF
          </p>
        </div>

        <div className="hero-visual">
          <span>YOUR AVIATION JOURNEY</span>
          <h2>Learn. Prepare. Take Off.</h2>
          <p>Building pathways into the aviation industry.</p>
        </div>
      </section>
    </main>
  )
}

export default Home