import "./globals.css";

export const metadata = {
  title: "Selección e Ingreso | ISSP",
  description: "Formulario de consultas del proceso de Selección e Ingreso"
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
