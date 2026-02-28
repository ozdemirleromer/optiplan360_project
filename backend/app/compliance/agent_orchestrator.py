from typing import List, Dict, Any
from .base_agent import BaseAgent, Finding

class AgentOrchestrator:
    """
    Orchestrates the execution of compliance agents.
    """

    def __init__(self, agents: List[BaseAgent]):
        self.agents = agents

    def run(self, data: Dict[str, Any]) -> Dict[str, Any]:
        findings = []
        for agent in self.agents:
            result = agent.run(data)
            data = result.get("data", data)
            findings.extend(result.get("findings", []))

        # Check for any blocking errors
        errors = [f for f in findings if f["severity"] == "ERROR"]
        if errors:
            return {"ok": False, "compliant_order": None, "report": findings}

        return {"ok": True, "compliant_order": data, "report": findings}