import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: { "^.+\\.ts$": "ts-jest" },
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/workers/**"],
  coverageDirectory: "coverage",
  setupFilesAfterEnv: [],
  testTimeout: 30000
};

export default config;