import './News.css'
function News() {
  return (
    <section className="news-section" id="news">
      <div className="news-heading">
        <p className="section-label">NEWS & UPDATES</p>

        <h2>Latest News from Skyrouting</h2>

        <p>
          Stay informed about school announcements,
          admission information, aviation training
          programmes and other important updates.
        </p>
      </div>

      <div className="news-empty-state">
        <h3>Official Updates Coming Soon</h3>

        <p>
          School announcements, training updates and
          admission notices will be published here.
          Please check back for the latest information.
        </p>
      </div>
    </section>
  )
}

export default News