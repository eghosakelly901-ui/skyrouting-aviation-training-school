import './Courses.css'
import courses from '../data/courses.js'

function Courses() {
  return (
    <section className="courses-section" id="courses">
      <div className="courses-heading">
        <p className="section-label">OUR TRAINING PROGRAMMES</p>

        <h2>Explore Our Aviation Training Courses</h2>

        <p>
          Discover our aviation training programmes and
          take the next step towards your aviation career.
        </p>
      </div>

      <div className="courses-grid">
        {courses.map((course, index) => (
          <article className="course-card" key={course.id}>
            <span className="course-number">
              {String(index + 1).padStart(2, '0')}
            </span>

            <h3>{course.title}</h3>
          </article>
        ))}
      </div>
    </section>
  )
}

export default Courses