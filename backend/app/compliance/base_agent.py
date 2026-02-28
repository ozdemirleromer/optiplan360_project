from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseAgent(ABC):
    """
    Abstract base class for all compliance agents.
    """

    @abstractmethod
    def run(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the agent logic.

        Args:
            data: The input data to validate or transform.

        Returns:
            A dictionary containing the transformed data and findings.
        """


class Finding:
    """
    Represents a compliance finding.
    """

    def __init__(self, severity: str, message: str):
        self.severity = severity  # ERROR, WARN, INFO
        self.message = message

    def to_dict(self):
        return {"severity": self.severity, "message": self.message}
