// Jest setup file

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage with proper Jest mock functions
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: jest.fn((key) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    length: 0,
    key: jest.fn(),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

global.localStorage = localStorageMock;

// Mock window.location
delete global.window.location;
global.window.location = {
  href: '',
  pathname: '/',
};
