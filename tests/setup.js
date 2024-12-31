global.chrome = {
  runtime: {
    getURL: jest.fn(path => `chrome-extension://mock-extension-id/${path}`),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    lastError: null
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  }
};

// Mock window.fs API
global.window = {
  ...global.window,
  fs: {
    readFile: jest.fn()
  }
};

// Reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});