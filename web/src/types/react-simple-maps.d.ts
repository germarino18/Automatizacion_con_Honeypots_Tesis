/*
 * Declaración mínima de tipos para react-simple-maps v3 (el paquete no
 * incluye .d.ts y no agregamos @types/react-simple-maps: solo se usan los
 * tres componentes del mapa compuesto).
 */
declare module 'react-simple-maps' {
  import type { ComponentType, ReactNode } from 'react';

  export interface ComposableMapProps {
    width?: number;
    height?: number;
    projection?: string;
    projectionConfig?: {
      center?: [number, number];
      rotate?: [number, number, number];
      scale?: number;
    };
    className?: string;
    children?: ReactNode;
  }

  export interface GeographyObject {
    rsmKey: string;
    id?: string;
    properties?: Record<string, unknown>;
  }

  export interface GeographiesProps {
    geography: string | Record<string, unknown>;
    className?: string;
    parseGeographies?: (input: unknown) => GeographyObject[];
    children:
      | ReactNode
      | ((args: { geographies: GeographyObject[] }) => ReactNode);
  }

  export interface GeographyProps {
    geography: GeographyObject;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    className?: string;
    children?: ReactNode;
  }

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const Geographies: ComponentType<GeographiesProps>;
  export const Geography: ComponentType<GeographyProps>;
}
