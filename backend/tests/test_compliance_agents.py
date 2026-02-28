import pytest
from app.compliance.part_type_rules_agent import PartTypeRulesAgent
from app.compliance.grain_mapping_agent import GrainMappingAgent
from app.compliance.agent_orchestrator import AgentOrchestrator

@pytest.fixture
def sample_order():
    return {
        "parts": [
            {
                "part_group": "ARKALIK",
                "edge_banding_u1": "Red",
                "edge_banding_u2": None,
                "edge_banding_k1": "Blue",
                "edge_banding_k2": None,
                "drilling_operations": True,
                "grain": "1"
            },
            {
                "part_group": "GOVDE",
                "edge_banding_u1": "Green",
                "grain": "2"
            }
        ]
    }

def test_part_type_rules_agent(sample_order):
    agent = PartTypeRulesAgent()
    result = agent.run(sample_order)

    assert len(result["findings"]) == 2
    assert result["findings"][0]["severity"] == "WARN"
    assert result["findings"][1]["severity"] == "ERROR"
    assert result["data"]["parts"][0]["edge_banding_u1"] is None

def test_grain_mapping_agent(sample_order):
    agent = GrainMappingAgent()
    result = agent.run(sample_order)

    assert len(result["findings"]) == 0
    assert result["data"]["parts"][0]["grain_opti"] == 1

def test_agent_orchestrator(sample_order):
    orchestrator = AgentOrchestrator([
        PartTypeRulesAgent(),
        GrainMappingAgent()
    ])

    result = orchestrator.run(sample_order)

    assert not result["ok"]
    assert len(result["report"]) > 0