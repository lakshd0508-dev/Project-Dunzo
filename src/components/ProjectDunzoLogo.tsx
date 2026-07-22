import React from 'react';

interface ProjectDunzoLogoProps {
  className?: string;
  alt?: string;
}

export const ProjectDunzoLogo: React.FC<ProjectDunzoLogoProps> = ({
  className = "h-12 w-auto",
  alt = "Project Dunzo Logo"
}) => {
  return (
    <img
      src="/project_dunzo_logo.png"
      alt={alt}
      className={`shrink-0 select-none object-contain ${className}`}
      referrerPolicy="no-referrer"
    />
  );
};

export default ProjectDunzoLogo;


