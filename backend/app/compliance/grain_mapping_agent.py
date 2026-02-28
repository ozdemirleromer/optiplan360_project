from .base_agent import BaseAgent, Finding
from typing import Dict, Any

class GrainMappingAgent(BaseAgent):
    """
    Ensures grain mapping compliance.
    """

    def run(self, data: Dict[str, Any]) -> Dict[str, Any]:
        findings = []
        parts = data.get("parts", [])

        for part in parts:
            grain = part.get("grain")
            if grain is None:
                findings.append(Finding("ERROR", "Grain direction is missing.").to_dict())
            elif grain not in ["0", "1", "2", "3"]:
                findings.append(Finding("ERROR", f"Invalid grain direction: {grain}.").to_dict())
            else:
                part["grain_opti"] = int(grain)  # Map to integer for OptiPlanning

        return {"data": data, "findings": findings}