"""
OptiPlan 360 - Neural Architecture Search (NAS) Service
AI-031: Otomatik neural network mimarisi arama ve optimizasyon

Bu modül:
- Otomatik neural network mimarisi keşfi
- Evolutionary / Reinforcement Learning tabanlı arama
- Hardware-aware architecture search
- Multi-objective optimization (accuracy + latency)
"""

import numpy as np
import torch
import torch.nn as nn
from typing import List, Dict, Tuple, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
import random
import copy
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


class OperationType(Enum):
    """NAS operasyon tipleri"""
    CONV_3X3 = "conv_3x3"
    CONV_5X5 = "conv_5x5"
    CONV_7X7 = "conv_7x7"
    DEPTHWISE_CONV_3X3 = "dw_conv_3x3"
    MAX_POOL_3X3 = "max_pool_3x3"
    AVG_POOL_3X3 = "avg_pool_3x3"
    SKIP_CONNECTION = "skip"
    SE_ATTENTION = "se_attention"  # Squeeze-and-Excitation
    IDENTITY = "identity"


@dataclass
class ArchitectureConfig:
    """Neural architecture konfigürasyonu"""
    num_layers: int = 8
    num_classes: int = 10
    input_channels: int = 3
    base_channels: int = 16
    operations: List[OperationType] = field(default_factory=lambda: [
        OperationType.CONV_3X3,
        OperationType.CONV_5X5,
        OperationType.DEPTHWISE_CONV_3X3,
        OperationType.MAX_POOL_3X3,
        OperationType.SE_ATTENTION,
        OperationType.IDENTITY
    ])
    max_params: int = 5_000_000  # 5M parametre limiti
    target_latency_ms: float = 50.0


@dataclass
class ArchitectureGenome:
    """Bireysel architecture genomu"""
    gene_id: str
    operations: List[OperationType]  # Her katman için operasyon
    channels: List[int]  # Her katman için kanal sayısı
    connections: List[List[int]]  # Skip connections
    fitness_score: float = 0.0
    accuracy: float = 0.0
    latency_ms: float = 0.0
    param_count: int = 0
    flops: int = 0
    generation: int = 0
    parent_ids: List[str] = field(default_factory=list)


class NeuralArchitectureSearch:
    """
    Neural Architecture Search (NAS) servisi.
    
    Algoritmalar:
    1. Evolutionary Search: Seçilim, çaprazlama, mutasyon
    2. RL-based: Controller RNN ile architecture generate
    3. Multi-objective: Accuracy + Latency + Model size
    """
    
    def __init__(
        self,
        config: ArchitectureConfig,
        population_size: int = 50,
        generations: int = 20,
        mutation_rate: float = 0.1,
        crossover_rate: float = 0.8
    ):
        self.config = config
        self.population_size = population_size
        self.generations = generations
        self.mutation_rate = mutation_rate
        self.crossover_rate = crossover_rate
        
        self.population: List[ArchitectureGenome] = []
        self.best_architectures: List[ArchitectureGenome] = []
        self.generation_stats: List[Dict] = []
        self.current_generation = 0
        
        # Hardware profiling (edge inference için)
        self.device_latency_cache: Dict[str, float] = {}
        
    def initialize_population(self) -> None:
        """Başlangıç populasyonunu oluştur"""
        logger.info(f"Populasyon oluşturuluyor: {self.population_size} birey")
        
        for i in range(self.population_size):
            genome = self._random_genome(f"gen_0_{i}")
            self.population.append(genome)
    
    def evolve(self, fitness_fn: Callable[[ArchitectureGenome], Tuple[float, float, float]]) -> ArchitectureGenome:
        """
        Evolutionary search çalıştır.
        
        Args:
            fitness_fn: (genome) -> (accuracy, latency_ms, param_count)
            
        Returns:
            En iyi architecture
        """
        logger.info(f"Evolution başlatıldı: {self.generations} jenerasyon")
        
        self.initialize_population()
        
        for gen in range(self.generations):
            self.current_generation = gen
            logger.info(f"Jenerasyon {gen + 1}/{self.generations}")
            
            # Fitness değerlendirme
            for genome in self.population:
                if genome.fitness_score == 0:  # Henüz değerlendirilmemiş
                    acc, latency, params = fitness_fn(genome)
                    genome.accuracy = acc
                    genome.latency_ms = latency
                    genome.param_count = params
                    genome.fitness_score = self._calculate_fitness(acc, latency, params)
            
            # İstatistik kaydet
            self._record_generation_stats(gen)
            
            # Elitleri koru
            elites = self._select_elites(n_elites=5)
            self.best_architectures.extend(elites)
            
            # Yeni populasyon oluştur
            new_population = elites.copy()
            
            while len(new_population) < self.population_size:
                # Seçilim
                parent1 = self._tournament_selection()
                parent2 = self._tournament_selection()
                
                # Çaprazlama
                if random.random() < self.crossover_rate:
                    child = self._crossover(parent1, parent2, f"gen_{gen+1}_{len(new_population)}")
                else:
                    child = copy.deepcopy(parent1)
                    child.gene_id = f"gen_{gen+1}_{len(new_population)}"
                
                # Mutasyon
                if random.random() < self.mutation_rate:
                    child = self._mutate(child)
                
                child.generation = gen + 1
                child.parent_ids = [parent1.gene_id, parent2.gene_id]
                
                new_population.append(child)
            
            self.population = new_population
        
        # En iyi sonuçları döndür
        best = max(self.population, key=lambda g: g.fitness_score)
        logger.info(f"Evolution tamamlandı. En iyi fitness: {best.fitness_score:.4f}")
        
        return best
    
    def search_efficientnet_style(
        self,
        target_resolution: int = 224,
        depth_multipliers: List[float] = [0.5, 0.75, 1.0, 1.25, 1.5],
        width_multipliers: List[float] = [0.5, 0.75, 1.0, 1.25, 1.5]
    ) -> List[ArchitectureGenome]:
        """
        EfficientNet tarzı compound scaling araması.
        
        Returns:
            Farklı scale'lerde architecture'lar (B0'dan B4'e)
        """
        logger.info("EfficientNet-style compound scaling başlatıldı")
        
        architectures = []
        
        for d in depth_multipliers:
            for w in width_multipliers:
                if d == 1.0 and w == 1.0:
                    # Base model (B0)
                    arch = self._create_base_architecture()
                else:
                    # Scaled model
                    arch = self._scale_architecture(d, w, target_resolution)
                
                # Profiling
                arch.param_count = self._estimate_params(arch)
                arch.flops = self._estimate_flops(arch, target_resolution)
                
                if arch.param_count <= self.config.max_params:
                    architectures.append(arch)
        
        # En iyi 5'i döndür
        architectures.sort(key=lambda a: a.flops)
        
        logger.info(f"{len(architectures)} architecture üretildi")
        return architectures[:5]
    
    def build_pytorch_model(self, genome: ArchitectureGenome) -> nn.Module:
        """
        Genome'dan PyTorch modeli oluştur.
        
        Returns:
            nn.Module
        """
        layers = []
        in_channels = self.config.input_channels
        
        for i, (op, ch) in enumerate(zip(genome.operations, genome.channels)):
            layer = self._create_operation(op, in_channels, ch)
            layers.append((f"layer_{i}", layer))
            in_channels = ch
        
        # Model sınıfı oluştur
        class NASModel(nn.Module):
            def __init__(self, layers_list, num_classes):
                super().__init__()
                self.layers = nn.ModuleList([l for _, l in layers_list])
                self.global_pool = nn.AdaptiveAvgPool2d(1)
                self.classifier = nn.Linear(layers_list[-1][1].out_channels, num_classes)
            
            def forward(self, x):
                for layer in self.layers:
                    x = layer(x)
                x = self.global_pool(x)
                x = x.view(x.size(0), -1)
                return self.classifier(x)
        
        return NASModel(layers, self.config.num_classes)
    
    def profile_on_device(
        self,
        genome: ArchitectureGenome,
        device: str = "cpu",
        input_size: Tuple[int, int, int, int] = (1, 3, 224, 224),
        runs: int = 100
    ) -> float:
        """
        Architecture'ı belirli bir cihazda profille.
        
        Returns:
            Ortalama inference latency (ms)
        """
        cache_key = f"{genome.gene_id}_{device}"
        
        if cache_key in self.device_latency_cache:
            return self.device_latency_cache[cache_key]
        
        model = self.build_pytorch_model(genome)
        model.eval()
        
        if device == "cuda" and torch.cuda.is_available():
            model = model.cuda()
            dummy_input = torch.randn(*input_size).cuda()
        else:
            dummy_input = torch.randn(*input_size)
        
        # Warm-up
        with torch.no_grad():
            for _ in range(10):
                _ = model(dummy_input)
        
        # Timing
        import time
        times = []
        
        with torch.no_grad():
            for _ in range(runs):
                start = time.time()
                _ = model(dummy_input)
                if device == "cuda":
                    torch.cuda.synchronize()
                times.append((time.time() - start) * 1000)
        
        avg_latency = np.median(times)
        self.device_latency_cache[cache_key] = avg_latency
        
        return avg_latency
    
    def get_search_report(self) -> Dict:
        """NAS arama raporu"""
        return {
            "config": {
                "population_size": self.population_size,
                "generations": self.generations,
                "mutation_rate": self.mutation_rate,
                "crossover_rate": self.crossover_rate
            },
            "current_generation": self.current_generation,
            "generation_stats": self.generation_stats,
            "best_architectures": [
                {
                    "gene_id": g.gene_id,
                    "fitness": g.fitness_score,
                    "accuracy": g.accuracy,
                    "latency_ms": g.latency_ms,
                    "params": g.param_count,
                    "flops": g.flops,
                    "operations": [op.value for op in g.operations]
                }
                for g in self.best_architectures[:10]
            ]
        }
    
    def _random_genome(self, gene_id: str) -> ArchitectureGenome:
        """Rastgele genome oluştur"""
        ops = [
            random.choice(self.config.operations)
            for _ in range(self.config.num_layers)
        ]
        
        # Kanal sayıları (artarak giden)
        base_ch = self.config.base_channels
        channels = [
            min(base_ch * (2 ** (i // 2)), 512)
            for i in range(self.config.num_layers)
        ]
        
        # Skip connections (her katman önceki 2 katmana bağlanabilir)
        connections = [
            random.sample(range(max(0, i-2), i), k=min(2, i))
            if i > 0 else []
            for i in range(self.config.num_layers)
        ]
        
        return ArchitectureGenome(
            gene_id=gene_id,
            operations=ops,
            channels=channels,
            connections=connections
        )
    
    def _calculate_fitness(
        self,
        accuracy: float,
        latency_ms: float,
        param_count: int
    ) -> float:
        """
        Multi-objective fitness hesapla.
        
        Goals:
        - Maximize accuracy
        - Minimize latency (< target)
        - Minimize param count (< max_params)
        """
        # Accuracy: 0-1 arası, doğrudan kullan
        acc_score = accuracy
        
        # Latency: target'in altında bonus, üzerinde ceza
        if latency_ms <= self.config.target_latency_ms:
            lat_score = 1.0
        else:
            lat_score = max(0, 1.0 - (latency_ms - self.config.target_latency_ms) / 100)
        
        # Param count: max_params'ın altında bonus
        if param_count <= self.config.max_params:
            param_score = 1.0
        else:
            param_score = max(0, self.config.max_params / param_count)
        
        # Weighted sum (accuracy ağırlıklı)
        fitness = 0.6 * acc_score + 0.25 * lat_score + 0.15 * param_score
        
        return fitness
    
    def _tournament_selection(self, tournament_size: int = 3) -> ArchitectureGenome:
        """Tournament selection"""
        tournament = random.sample(self.population, min(tournament_size, len(self.population)))
        return max(tournament, key=lambda g: g.fitness_score)
    
    def _select_elites(self, n_elites: int) -> List[ArchitectureGenome]:
        """En iyi n_elites bireyi seç"""
        sorted_pop = sorted(self.population, key=lambda g: g.fitness_score, reverse=True)
        return sorted_pop[:n_elites]
    
    def _crossover(
        self,
        parent1: ArchitectureGenome,
        parent2: ArchitectureGenome,
        child_id: str
    ) -> ArchitectureGenome:
        """İki ebeveyn arasında çaprazlama"""
        # Uniform crossover (her katman için rastgele ebeveyn seç)
        child_ops = [
            random.choice([p1, p2])
            for p1, p2 in zip(parent1.operations, parent2.operations)
        ]
        
        child_channels = [
            random.choice([c1, c2])
            for c1, c2 in zip(parent1.channels, parent2.channels)
        ]
        
        return ArchitectureGenome(
            gene_id=child_id,
            operations=child_ops,
            channels=child_channels,
            connections=copy.deepcopy(parent1.connections)
        )
    
    def _mutate(self, genome: ArchitectureGenome) -> ArchitectureGenome:
        """Genom üzerinde mutasyon"""
        mutant = copy.deepcopy(genome)
        
        # Operasyon mutasyonu
        for i in range(len(mutant.operations)):
            if random.random() < 0.1:  # %10 olasılık
                mutant.operations[i] = random.choice(self.config.operations)
        
        # Kanal mutasyonu
        for i in range(len(mutant.channels)):
            if random.random() < 0.1:
                # Kanalı %25 artır veya azalt
                delta = random.choice([-0.25, 0.25])
                mutant.channels[i] = int(mutant.channels[i] * (1 + delta))
                mutant.channels[i] = max(16, min(512, mutant.channels[i]))
        
        return mutant
    
    def _record_generation_stats(self, gen: int) -> None:
        """Jenerasyon istatistiklerini kaydet"""
        fitnesses = [g.fitness_score for g in self.population]
        
        self.generation_stats.append({
            "generation": gen,
            "best_fitness": max(fitnesses),
            "avg_fitness": np.mean(fitnesses),
            "worst_fitness": min(fitnesses),
            "diversity": np.std(fitnesses),
            "best_accuracy": max(g.accuracy for g in self.population),
            "best_latency": min(g.latency_ms for g in self.population if g.latency_ms > 0) if any(g.latency_ms > 0 for g in self.population) else 0
        })
    
    def _create_operation(self, op: OperationType, in_ch: int, out_ch: int) -> nn.Module:
        """Operasyon oluştur"""
        if op == OperationType.CONV_3X3:
            return nn.Sequential(
                nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False),
                nn.BatchNorm2d(out_ch),
                nn.ReLU(inplace=True)
            )
        elif op == OperationType.CONV_5X5:
            return nn.Sequential(
                nn.Conv2d(in_ch, out_ch, 5, padding=2, bias=False),
                nn.BatchNorm2d(out_ch),
                nn.ReLU(inplace=True)
            )
        elif op == OperationType.DEPTHWISE_CONV_3X3:
            return nn.Sequential(
                nn.Conv2d(in_ch, in_ch, 3, padding=1, groups=in_ch, bias=False),
                nn.BatchNorm2d(in_ch),
                nn.ReLU(inplace=True),
                nn.Conv2d(in_ch, out_ch, 1, bias=False),
                nn.BatchNorm2d(out_ch),
                nn.ReLU(inplace=True)
            )
        elif op == OperationType.SE_ATTENTION:
            return SqueezeExcitation(in_ch, reduction=16)
        elif op == OperationType.MAX_POOL_3X3:
            return nn.MaxPool2d(3, stride=1, padding=1)
        elif op == OperationType.IDENTITY:
            if in_ch == out_ch:
                return nn.Identity()
            else:
                return nn.Conv2d(in_ch, out_ch, 1, bias=False)
        else:
            return nn.Identity()
    
    def _estimate_params(self, genome: ArchitectureGenome) -> int:
        """Parametre sayısını tahmin et"""
        total = 0
        for op, ch_in, ch_out in zip(genome.operations, [self.config.input_channels] + genome.channels[:-1], genome.channels):
            if op in [OperationType.CONV_3X3, OperationType.CONV_5X5]:
                kernel = 3 if op == OperationType.CONV_3X3 else 5
                total += kernel * kernel * ch_in * ch_out + ch_out  # + bias
            elif op == OperationType.DEPTHWISE_CONV_3X3:
                total += 3 * 3 * ch_in + ch_in * ch_out
        
        return total
    
    def _estimate_flops(self, genome: ArchitectureGenome, resolution: int) -> int:
        """FLOPs tahmini"""
        # Basit tahmin: her katman için ~2 * params * resolution^2 / stride^2
        params = self._estimate_params(genome)
        return params * resolution * resolution // 4
    
    def _create_base_architecture(self) -> ArchitectureGenome:
        """Base architecture (EfficientNet-B0 style)"""
        return ArchitectureGenome(
            gene_id="efficientnet_b0_base",
            operations=[OperationType.CONV_3X3] * self.config.num_layers,
            channels=[32, 16, 24, 24, 40, 40, 80, 80],
            connections=[[] for _ in range(self.config.num_layers)],
            param_count=5_300_000,
            flops=390_000_000
        )
    
    def _scale_architecture(
        self,
        depth_mult: float,
        width_mult: float,
        resolution: int
    ) -> ArchitectureGenome:
        """Compound scaling uygula"""
        base = self._create_base_architecture()
        
        # Depth scaling
        new_num_layers = int(len(base.operations) * depth_mult)
        
        # Width scaling
        new_channels = [int(ch * width_mult) for ch in base.channels[:new_num_layers]]
        new_channels = [max(16, (ch // 8) * 8) for ch in new_channels]  # 8'in katı
        
        return ArchitectureGenome(
            gene_id=f"efficientnet_d{depth_mult}_w{width_mult}",
            operations=base.operations[:new_num_layers],
            channels=new_channels,
            connections=base.connections[:new_num_layers],
            param_count=int(base.param_count * depth_mult * width_mult ** 2),
            flops=int(base.flops * depth_mult * width_mult ** 2 * (resolution / 224) ** 2)
        )


class SqueezeExcitation(nn.Module):
    """Squeeze-and-Excitation attention module"""
    
    def __init__(self, channels: int, reduction: int = 16):
        super().__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Sequential(
            nn.Linear(channels, channels // reduction, bias=False),
            nn.ReLU(inplace=True),
            nn.Linear(channels // reduction, channels, bias=False),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        b, c, _, _ = x.size()
        y = self.avg_pool(x).view(b, c)
        y = self.fc(y).view(b, c, 1, 1)
        return x * y.expand_as(x)


# Global NAS instance
nas_service = NeuralArchitectureSearch(ArchitectureConfig())
