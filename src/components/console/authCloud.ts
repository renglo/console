export type AuthCloud = 'aws' | 'azure';

export function authCloud(value?: string): AuthCloud {
  const configured = value ?? readCloud();
  return String(configured ?? 'aws').trim().toLowerCase() === 'azure' ? 'azure' : 'aws';
}

export function authClientName(value?: string): 'entra' | 'cognito' {
  return authCloud(value) === 'azure' ? 'entra' : 'cognito';
}

function readCloud(): string | undefined {
  try {
    return import.meta.env?.VITE_CLOUD;
  } catch {
    return undefined;
  }
}
