"""Stable exceptions exposed by P4 provider services to P3 orchestration."""


class ProviderIntegrationError(Exception):
    """Base class for safe provider integration failures."""


class ProviderNotConfigured(ProviderIntegrationError):
    """Required server-side provider configuration is absent."""


class ProviderAuthenticationError(ProviderIntegrationError):
    """The upstream provider rejected server authentication."""


class ProviderRateLimited(ProviderIntegrationError):
    """The upstream provider rejected a request due to rate or quota limits."""


class ProviderTimeout(ProviderIntegrationError):
    """The provider operation exceeded the configured deadline."""


class ProviderUnavailable(ProviderIntegrationError):
    """The upstream provider could not complete a valid request."""


class ProviderPolicyError(ProviderIntegrationError):
    """The provider declined output due to policy or safety handling."""


class StructuredOutputError(ProviderIntegrationError):
    """A model returned no usable structured result."""


class ProviderResponseValidationError(StructuredOutputError):
    """A structured provider result failed application validation."""


class UnsupportedAudioFormat(ProviderIntegrationError):
    """Audio cannot be passed to the target provider without conversion."""


class FaceNotAllowed(ProviderIntegrationError):
    """The configured Simli face is not available to this account."""


class SessionLimitExceeded(ProviderIntegrationError):
    """A provider session or account concurrency limit was reached."""
