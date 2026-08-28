"use client";

export default function Landing() {
  const handleFormClick = () => {
    window.location.href = "/formulario";
  };

  return (
    <div className="landing-page">
      {/* Header con Logo */}
      <header className="header">
        <div className="header-container">
          <div className="logo-section">
            <img 
              src="/logo-horizontal.webp" 
              alt="ISSP" 
              className="logo-horizontal"
            />
          </div>
          <nav className="nav">
            <a href="#consultas">Consultas</a>
            <a href="mailto:info@insusep.edu.ar">Contacto</a>
          </nav>
        </div>
      </header>

      {/* Hero Section con Imagen de Fondo */}
      <section className="hero-section">
        <div 
          className="hero-background"
          style={{
            backgroundImage: `url('/hero-issp.jpg')`,
          }}
        >
          <div className="hero-gradient-top"></div>
          <div className="hero-gradient-bottom"></div>
          <div className="hero-gradient-left"></div>
          <div className="hero-gradient-right"></div>
        </div>

        <div className="hero-content">
          <h1 className="hero-title">Instituto Superior de Seguridad Pública</h1>
          <p className="hero-subtitle">Departamento de Selección e Ingreso</p>
          <p className="hero-description">
            Formando profesionales de excelencia en seguridad pública para la Ciudad de Buenos Aires
          </p>

          <button onClick={handleFormClick} className="hero-button">
            Acceder al Formulario de Consultas
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </section>

      {/* CTA Section */}
     

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h3>Instituto Superior de Seguridad Pública</h3>
            <p>Formando profesionales de excelencia en seguridad pública para la Ciudad de Buenos Aires</p>
          </div>

          <div className="footer-section">
            <h4>Contacto</h4>
            <p><strong>Dirección:</strong> Santiago de Compostela 3801, Bajo Flores, Buenos Aires</p>
            <p><strong>Teléfono:</strong> 4323-8910</p>
            <p><strong>Email:</strong> info@insusep.edu.ar</p>
          </div>

          <div className="footer-section">
            <h4>Horario de Atención</h4>
            <p>Lunes a viernes: 8:00 - 17:00 hs</p>
            <p>Atención de consultas: Lunes a viernes</p>
          </div>

          <div className="footer-section">
            <h4>Redes Sociales</h4>
            <div className="social-links">
              <a href="https://www.instagram.com/isspcaba" target="_blank" title="Instagram">📷</a>
              <a href="https://www.facebook.com/isspcaba" target="_blank" title="Facebook">f</a>
              <a href="https://www.youtube.com/@institutossp" target="_blank" title="YouTube">▶</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 Instituto Superior de Seguridad Pública (ISSP) | Ministerio de Justicia y Seguridad CABA</p>
          <p>Todos los derechos reservados</p>
        </div>
      </footer>

      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .landing-page {
          min-height: 100vh;
          background: #f8fafb;
          overflow-x: hidden;
          font-family: 'Georgia', 'Garamond', serif;
        }

        .header {
          background: white;
          border-bottom: 3px solid #0066cc;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .logo-section {
          display: flex;
          align-items: center;
        }

        .logo-horizontal {
          height: 60px;
          width: auto;
          object-fit: contain;
        }

        .nav {
          display: flex;
          gap: 32px;
        }

        .nav a {
          color: #003d7a;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: color 0.3s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        }

        .nav a:hover {
          color: #0066cc;
        }

        .hero-section {
          position: relative;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          overflow: hidden;
        }

        .hero-background {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-size: cover;
          background-position: center;
          background-attachment: fixed;
          z-index: 1;
        }

        .hero-gradient-top {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 60%;
          background: linear-gradient(180deg, rgba(0, 61, 122, 0.85) 0%, rgba(0, 61, 122, 0.4) 100%);
          z-index: 2;
        }

        .hero-gradient-bottom {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 40%;
          background: linear-gradient(0deg, rgba(0, 31, 77, 0.95) 0%, rgba(0, 61, 122, 0.3) 100%);
          z-index: 2;
        }

        .hero-gradient-left {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 30%;
          background: linear-gradient(90deg, rgba(0, 31, 77, 0.8) 0%, transparent 100%);
          z-index: 2;
        }

        .hero-gradient-right {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 30%;
          background: linear-gradient(270deg, rgba(0, 31, 77, 0.8) 0%, transparent 100%);
          z-index: 2;
        }

        .hero-content {
          position: relative;
          z-index: 3;
          text-align: center;
          max-width: 700px;
          padding: 20px;
          animation: fadeInUp 1s ease-out;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hero-logo {
          margin-bottom: 30px;
        }

        .logo-circle {
          width: 100px;
          height: 100px;
          object-fit: contain;
          filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
        }

        .hero-title {
          font-size: clamp(36px, 6vw, 64px);
          font-weight: 700;
          margin: 0 0 15px;
          letter-spacing: -1px;
          line-height: 1.2;
          font-family: 'Georgia', serif;
          text-shadow: 0 4px 16px rgba(0, 0, 0, 0.7), 0 2px 8px rgba(0, 0, 0, 0.5);
        }

        .hero-subtitle {
          font-size: 22px;
          margin: 0 0 20px;
          opacity: 1;
          font-weight: 400;
          font-style: italic;
          text-shadow: 0 3px 12px rgba(0, 0, 0, 0.6);
        }

        .hero-description {
          font-size: 18px;
          margin: 0 0 40px;
          opacity: 1;
          line-height: 1.7;
          text-shadow: 0 3px 12px rgba(0, 0, 0, 0.6);
        }

        .hero-button {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: white;
          color: #003d7a;
          padding: 18px 44px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          border: none;
          transition: all 0.3s ease;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        }

        .hero-button:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          background: #f0f7ff;
        }

        .hero-button:active {
          transform: translateY(-2px);
        }

        .hero-button svg {
          transition: transform 0.3s ease;
        }

        .hero-button:hover svg {
          transform: translateX(4px);
        }

        .cta-section {
          padding: 80px 20px;
          background: linear-gradient(135deg, #003d7a 0%, #0066cc 100%);
          color: white;
          text-align: center;
        }

        .cta-content h2 {
          font-size: clamp(28px, 4vw, 40px);
          margin: 0 0 16px;
          font-weight: 700;
          font-family: 'Georgia', serif;
        }

        .cta-content p {
          font-size: 16px;
          margin: 0 0 32px;
          opacity: 0.95;
          max-width: 500px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.6;
        }

        .cta-button {
          display: inline-block;
          background: white;
          color: #003d7a;
          padding: 16px 40px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          border: none;
          transition: all 0.3s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        }

        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          background: #f0f7ff;
        }

        .landing-footer {
          padding: 60px 20px 30px;
          background: #2a2a2a;
          color: rgba(255, 255, 255, 0.9);
          font-family: 'Garamond', 'Georgia', serif;
        }

        .footer-content {
          max-width: 1200px;
          margin: 0 auto 40px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 40px;
        }

        .footer-section h3 {
          font-size: 18px;
          margin: 0 0 16px;
          color: #ffffff;
          font-weight: 700;
          font-family: 'Garamond', 'Georgia', serif;
          letter-spacing: 0.3px;
        }

        .footer-section h4 {
          font-size: 12px;
          margin: 0 0 14px;
          color: #c0c0c0;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-family: 'Garamond', 'Georgia', serif;
        }

        .footer-section p {
          margin: 10px 0;
          font-size: 13px;
          line-height: 1.8;
          color: rgba(255, 255, 255, 0.8);
          font-family: 'Garamond', 'Georgia', serif;
          font-weight: 400;
        }

        .footer-section strong {
          color: rgba(255, 255, 255, 0.95);
        }

        .social-links {
          display: flex;
          gap: 16px;
          margin-top: 12px;
        }

        .social-links a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
          border-radius: 6px;
          text-decoration: none;
          transition: all 0.3s ease;
          font-weight: 700;
          font-size: 20px;
        }

        .social-links a:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }

        .footer-links {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .footer-links li {
          margin: 10px 0;
        }

        .footer-links a {
          color: rgba(255, 255, 255, 0.8);
          text-decoration: none;
          transition: all 0.3s ease;
          font-weight: 500;
          font-family: 'Garamond', 'Georgia', serif;
        }

        .footer-links a:hover {
          color: #ffffff;
          text-decoration: underline;
        }

        .footer-bottom {
          max-width: 1200px;
          margin: 0 auto;
          padding-top: 30px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          text-align: center;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
          font-family: 'Garamond', 'Georgia', serif;
          letter-spacing: 0.3px;
        }

        .footer-bottom p {
          margin: 6px 0;
          line-height: 1.7;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .header-container {
            flex-direction: column;
            gap: 16px;
          }

          .nav {
            flex-direction: column;
            gap: 12px;
            font-size: 12px;
          }

          .logo-horizontal {
            height: 50px;
          }

          .hero-section {
            height: 85vh;
          }

          .hero-button,
          .cta-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
