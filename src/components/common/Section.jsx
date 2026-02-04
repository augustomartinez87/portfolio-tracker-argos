import React from 'react';

/**
 * Sección con título e icono
 *
 * @param {Object} props
 * @param {string} props.title - Título de la sección
 * @param {React.ComponentType} props.icon - Icono de Lucide
 * @param {React.ReactNode} props.children - Contenido de la sección
 * @param {string} props.className - Clases adicionales
 */
export function Section({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5 text-primary" />}
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default Section;
