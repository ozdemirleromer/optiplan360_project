from typing import Any, Dict

from .base_agent import BaseAgent, Finding


class PartTypeRulesAgent(BaseAgent):
    """
    Ensures compliance with part type rules.
    """

    def run(self, data: Dict[str, Any]) -> Dict[str, Any]:
        findings = []
        parts = data.get("parts", [])

        for part in parts:
            if part.get("part_group") == "ARKALIK":
                # Check for edge banding
                if any(
                    [
                        part.get("edge_banding_u1"),
                        part.get("edge_banding_u2"),
                        part.get("edge_banding_k1"),
                        part.get("edge_banding_k2"),
                    ]
                ):
                    findings.append(
                        Finding("WARN", "Edge banding removed for ARKALIK part.").to_dict()
                    )
                    part["edge_banding_u1"] = None
                    part["edge_banding_u2"] = None
                    part["edge_banding_k1"] = None
                    part["edge_banding_k2"] = None

                # Check for drilling operations
                if part.get("drilling_operations"):
                    findings.append(
                        Finding(
                            "ERROR", "Drilling operations not allowed for ARKALIK parts."
                        ).to_dict()
                    )

        return {"data": data, "findings": findings}
