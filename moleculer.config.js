import { nanoid } from "nanoid"

const {
  REDIS_CONNECTION_STRING,
} = process.env;

export default {
  namespace: "api-unidos-moleculer",
  
  metrics: {
		enabled: false,
		// Available built-in reporters: "Console", "CSV", "Event", "Prometheus", "Datadog", "StatsD"
		reporter: {
			type: "Console",
			options: {
				// HTTP port
				port: 3030,
				// HTTP URL path
				path: "/metrics",
				// Default labels which are appended to all metrics labels
				defaultLabels: (registry) => ({
					namespace: registry.broker.namespace,
					nodeID: registry.broker.nodeID,
				}),
			},
		},
	},
  middlewares: [],
  hotReload: true,
  nodeID: nanoid(),
  serializer: "Avro",
  uidGenerator: () => nanoid(),
  requestTimeout: 10 * 1000,
  transporter: null,
  disableBalancer: false,
  logger: {
    type: "Console",
    options: {
      colors: true,
      level: "info",
      autoPadding: false,
      formatter: "short",
      moduleColors: true,
      objectPrinter: false,
    }
  },

  cacher: "Memory",

	registry: {
		// Define balancing strategy. More info: https://moleculer.services/docs/0.14/balancing.html
		// Available values: "RoundRobin", "Random", "CpuUsage", "Latency", "Shard"
		strategy: "RoundRobin",
		// Enable local action call preferring. Always call the local action instance if available.
		preferLocal: true
	},

  tracing: {
		enabled: true,
		// Available built-in exporters: "Console", "Datadog", "Event", "EventLegacy", "Jaeger", "Zipkin"
		exporter: {
			type: "Console", // Console exporter is only for development!
			options: {
				// Custom logger
				logger: null,
				// Using colors
				colors: true,
				// Width of row
				width: 100,
				// Gauge width in the row
				gaugeWidth: 40,
			},
		},
	},

  retryPolicy: {
		// Enable feature
		enabled: false,
		// Count of retries
		retries: 5,
		// First delay in milliseconds.
		delay: 100,
		// Maximum delay in milliseconds.
		maxDelay: 1000,
		// Backoff factor for delay. 2 means exponential backoff.
		factor: 2,
		// A function to check failed requests.
		check: err => err && !!err.retryable
	},
};
