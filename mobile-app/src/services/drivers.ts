export type Location = {
  latitude: number;
  longitude: number;
};

export type UpdateDriverLocationPayload = {
  driverId: string;
  location: Location;
  bearing?: number;
};

export type UpdateDriverLocationResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export type DriverBeaconMetadata = {
  driverId: string;
  uuid: string;
  major: number;
  minor: number;
};

export const updateDriverLocation = async (
  apiBaseUrl: string,
  payload: UpdateDriverLocationPayload,
): Promise<UpdateDriverLocationResponse> => {
  const response = await fetch(`${apiBaseUrl}/drivers/location`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      typeof responseData.message === 'string'
        ? responseData.message
        : typeof responseData.error === 'string'
          ? responseData.error
          : 'Could not update driver location';

    throw new Error(errorMessage);
  }

  return responseData as UpdateDriverLocationResponse;
};

export const getDriverBeaconMetadata = async (
  apiBaseUrl: string,
  driverId: string,
): Promise<DriverBeaconMetadata> => {
  const response = await fetch(`${apiBaseUrl}/drivers/${encodeURIComponent(driverId)}/beacon`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      typeof responseData.message === 'string'
        ? responseData.message
        : typeof responseData.error === 'string'
          ? responseData.error
          : response.status === 404
            ? 'Beacon info not found for driver'
            : 'Could not load driver beacon metadata';

    throw new Error(errorMessage);
  }

  return responseData as DriverBeaconMetadata;
};
