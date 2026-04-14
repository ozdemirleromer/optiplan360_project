"""
OptiPlan 360 - Large Language Models (LLM) Service
AI-050: LLM fine-tuning ve prompt engineering entegrasyonu

Bu modül:
- HuggingFace Transformers entegrasyonu
- LoRA/QLoRA fine-tuning
- RAG (Retrieval Augmented Generation)
- Prompt engineering ve template management
- Chat completion ve text generation
"""

import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
    pipeline
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training, PeftModel
from typing import List, Dict, Optional, Tuple, Iterator
from dataclasses import dataclass, field
import logging
from pathlib import Path
import json

logger = logging.getLogger(__name__)


@dataclass
class LLMConfig:
    """LLM konfigürasyonu"""
    model_name: str = "microsoft/DialoGPT-medium"
    max_length: int = 512
    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 50
    repetition_penalty: float = 1.1
    
    # Fine-tuning
    use_lora: bool = True
    lora_r: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05
    target_modules: List[str] = field(default_factory=lambda: ["q_proj", "v_proj"])
    
    # Quantization
    load_in_4bit: bool = True
    load_in_8bit: bool = False
    bnb_4bit_compute_dtype: str = "float16"
    
    # RAG
    use_rag: bool = True
    rag_top_k: int = 5
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"


@dataclass
class ChatMessage:
    """Chat mesajı"""
    role: str  # "system", "user", "assistant"
    content: str
    timestamp: Optional[str] = None


@dataclass
class RAGDocument:
    """RAG dokümanı"""
    id: str
    content: str
    metadata: Dict
    embedding: Optional[List[float]] = None
    score: float = 0.0


class LLMService:
    """
    Large Language Model servisi.
    
    Features:
    - Text generation
    - Chat completion
    - RAG (Retrieval Augmented Generation)
    - Fine-tuning support
    """
    
    def __init__(self, config: LLMConfig):
        self.config = config
        self.model = None
        self.tokenizer = None
        self.rag_retriever = None
        self.is_loaded = False
        
    def load_model(self, model_path: Optional[str] = None) -> bool:
        """
        LLM modelini yükle.
        
        Args:
            model_path: HuggingFace model adı veya local path
            
        Returns:
            Başarılı mı
        """
        model_name = model_path or self.config.model_name
        
        logger.info(f"LLM yükleniyor: {model_name}")
        
        try:
            # Quantization config
            bnb_config = None
            if self.config.load_in_4bit:
                bnb_config = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_quant_type="nf4",
                    bnb_4bit_compute_dtype=getattr(torch, self.config.bnb_4bit_compute_dtype),
                    bnb_4bit_use_double_quant=True,
                )
            elif self.config.load_in_8bit:
                bnb_config = BitsAndBytesConfig(load_in_8bit=True)
            
            # Tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                trust_remote_code=True
            )
            
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            # Model
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                quantization_config=bnb_config,
                device_map="auto",
                trust_remote_code=True,
                torch_dtype=torch.float16 if bnb_config else torch.float32
            )
            
            # LoRA ekle (eğer aktifse)
            if self.config.use_lora:
                self._apply_lora()
            
            self.is_loaded = True
            logger.info("LLM başarıyla yüklendi")
            return True
            
        except Exception as e:
            logger.error(f"LLM yükleme hatası: {e}")
            return False
    
    def _apply_lora(self):
        """LoRA adaptörlerini uygula"""
        logger.info("LoRA uygulanıyor...")
        
        # Prepare for k-bit training
        self.model = prepare_model_for_kbit_training(self.model)
        
        # LoRA config
        lora_config = LoraConfig(
            r=self.config.lora_r,
            lora_alpha=self.config.lora_alpha,
            target_modules=self.config.target_modules,
            lora_dropout=self.config.lora_dropout,
            bias="none",
            task_type="CAUSAL_LM"
        )
        
        self.model = get_peft_model(self.model, lora_config)
        self.model.print_trainable_parameters()
    
    def generate_text(
        self,
        prompt: str,
        max_new_tokens: int = 256,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        stream: bool = False
    ) -> str:
        """
        Metin üret.
        
        Args:
            prompt: Giriş prompt'u
            max_new_tokens: Üretilecek maksimum token
            stream: Streaming output
            
        Returns:
            Üretilen metin
        """
        if not self.is_loaded:
            raise RuntimeError("Model yüklenmemiş. Önce load_model() çağırın.")
        
        # Tokenize
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=self.config.max_length
        ).to(self.model.device)
        
        # Generate
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=temperature or self.config.temperature,
                top_p=top_p or self.config.top_p,
                top_k=self.config.top_k,
                repetition_penalty=self.config.repetition_penalty,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )
        
        # Decode
        generated_text = self.tokenizer.decode(
            outputs[0][inputs['input_ids'].shape[1]:],
            skip_special_tokens=True
        )
        
        return generated_text.strip()
    
    def chat_completion(
        self,
        messages: List[ChatMessage],
        max_new_tokens: int = 512
    ) -> str:
        """
        Chat completion API.
        
        Args:
            messages: Chat geçmişi
            max_new_tokens: Maksimum token
            
        Returns:
            Assistant yanıtı
        """
        # Format messages
        formatted_prompt = self._format_chat_prompt(messages)
        
        # RAG kontekst ekle
        if self.config.use_rag and self.rag_retriever:
            last_user_message = messages[-1].content if messages[-1].role == "user" else ""
            rag_context = self._get_rag_context(last_user_message)
            if rag_context:
                formatted_prompt = f"Context: {rag_context}\n\n{formatted_prompt}"
        
        # Generate
        response = self.generate_text(formatted_prompt, max_new_tokens)
        
        return response
    
    def _format_chat_prompt(self, messages: List[ChatMessage]) -> str:
        """Chat mesajlarını prompt formatına çevir"""
        formatted = ""
        
        for msg in messages:
            if msg.role == "system":
                formatted += f"System: {msg.content}\n"
            elif msg.role == "user":
                formatted += f"User: {msg.content}\n"
            elif msg.role == "assistant":
                formatted += f"Assistant: {msg.content}\n"
        
        formatted += "Assistant:"
        return formatted
    
    def fine_tune(
        self,
        train_data_path: str,
        output_dir: str,
        num_epochs: int = 3,
        batch_size: int = 4,
        learning_rate: float = 2e-4
    ) -> Dict:
        """
        LoRA fine-tuning yap.
        
        Args:
            train_data_path: JSONL formatında eğitim verisi
            output_dir: Model kayıt dizini
            num_epochs: Epoch sayısı
            
        Returns:
            Eğitim sonuçları
        """
        from datasets import load_dataset
        from trl import SFTTrainer
        
        logger.info(f"Fine-tuning başlatıldı: {num_epochs} epochs")
        
        # Load dataset
        dataset = load_dataset('json', data_files=train_data_path, split='train')
        
        # Training arguments
        training_args = TrainingArguments(
            output_dir=output_dir,
            num_train_epochs=num_epochs,
            per_device_train_batch_size=batch_size,
            gradient_accumulation_steps=4,
            learning_rate=learning_rate,
            logging_steps=10,
            save_strategy="epoch",
            fp16=True,
            optim="paged_adamw_8bit",
        )
        
        # Trainer
        trainer = SFTTrainer(
            model=self.model,
            train_dataset=dataset,
            args=training_args,
            tokenizer=self.tokenizer,
            max_seq_length=self.config.max_length,
            dataset_text_field="text"
        )
        
        # Train
        train_result = trainer.train()
        
        # Save
        trainer.save_model(output_dir)
        
        logger.info(f"Fine-tuning tamamlandı. Model: {output_dir}")
        
        return {
            "train_loss": train_result.training_loss,
            "train_runtime": train_result.metrics.get("train_runtime", 0),
            "output_dir": output_dir
        }
    
    def load_fine_tuned(self, adapter_path: str) -> bool:
        """Fine-tuned LoRA adaptörünü yükle"""
        try:
            self.model = PeftModel.from_pretrained(self.model, adapter_path)
            logger.info(f"Fine-tuned model yüklendi: {adapter_path}")
            return True
        except Exception as e:
            logger.error(f"Adaptör yükleme hatası: {e}")
            return False


class RAGRetriever:
    """
    RAG (Retrieval Augmented Generation) retriever.
    
    Knowledge base'den ilgili dokümanları çek.
    """
    
    def __init__(self, embedding_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.embedding_model_name = embedding_model_name
        self.embedding_model = None
        self.documents: List[RAGDocument] = []
        self.is_loaded = False
        
    def load_embedding_model(self) -> bool:
        """Embedding modelini yükle"""
        try:
            from sentence_transformers import SentenceTransformer
            self.embedding_model = SentenceTransformer(self.embedding_model_name)
            self.is_loaded = True
            logger.info(f"Embedding model yüklendi: {self.embedding_model_name}")
            return True
        except Exception as e:
            logger.error(f"Embedding model yükleme hatası: {e}")
            return False
    
    def add_documents(self, documents: List[RAGDocument]) -> None:
        """Dokümanları knowledge base'e ekle"""
        if not self.is_loaded:
            self.load_embedding_model()
        
        # Embedding'leri hesapla
        for doc in documents:
            if doc.embedding is None:
                doc.embedding = self._compute_embedding(doc.content)
        
        self.documents.extend(documents)
        logger.info(f"{len(documents)} doküman eklendi. Toplam: {len(self.documents)}")
    
    def search(
        self,
        query: str,
        top_k: int = 5,
        score_threshold: float = 0.5
    ) -> List[RAGDocument]:
        """
        Query'ye göre en yakın dokümanları bul.
        
        Args:
            query: Arama sorgusu
            top_k: Döndürülecek doküman sayısı
            score_threshold: Minimum benzerlik skoru
            
        Returns:
            İlgili doküman listesi
        """
        if not self.is_loaded:
            raise RuntimeError("Embedding model yüklenmemiş")
        
        # Query embedding
        query_embedding = self._compute_embedding(query)
        
        # Similarity hesapla
        results = []
        for doc in self.documents:
            if doc.embedding:
                similarity = self._cosine_similarity(query_embedding, doc.embedding)
                if similarity >= score_threshold:
                    doc.score = similarity
                    results.append(doc)
        
        # Sırala ve top_k seç
        results.sort(key=lambda x: x.score, reverse=True)
        
        return results[:top_k]
    
    def _compute_embedding(self, text: str) -> List[float]:
        """Metin embedding'i hesapla"""
        if self.embedding_model is None:
            raise RuntimeError("Embedding model yüklenmemiş")
        
        embedding = self.embedding_model.encode(text)
        return embedding.tolist()
    
    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Cosine benzerliği hesapla"""
        import numpy as np
        
        a = np.array(a)
        b = np.array(b)
        
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


class PromptTemplateManager:
    """
    Prompt template yönetimi.
    
    Pre-defined prompt template'ler:
    - Summarization
    - Entity extraction
    - Classification
    - Question answering
    """
    
    TEMPLATES = {
        "summarize": """
Summarize the following text in a concise manner:

{text}

Summary:""",
        
        "extract_entities": """
Extract the following entities from the text:
- Company names
- Person names
- Dates
- Locations
- Product names

Text: {text}

Entities:""",
        
        "classify_intent": """
Classify the user intent into one of the following categories:
- ORDER_INQUIRY
- PRODUCT_INQUIRY
- SHIPPING_INQUIRY
- COMPLAINT
- GENERAL_QUESTION

User message: {text}

Intent:""",
        
        "answer_question": """
Answer the question based on the provided context.

Context:
{context}

Question: {question}

Answer:""",
        
        "generate_sql": """
Generate a SQL query to answer the following question.
Database schema:
{schema}

Question: {question}

SQL Query:"""
    }
    
    @classmethod
    def get_template(cls, template_name: str) -> str:
        """Template getir"""
        return cls.TEMPLATES.get(template_name, "")
    
    @classmethod
    def format_prompt(cls, template_name: str, **kwargs) -> str:
        """Template'i formatla"""
        template = cls.get_template(template_name)
        return template.format(**kwargs)


class LLMInferencePipeline:
    """
    End-to-end LLM inference pipeline.
    
    RAG + Prompt Engineering + Generation
    """
    
    def __init__(self, llm_service: LLMService, rag_retriever: Optional[RAGRetriever] = None):
        self.llm = llm_service
        self.rag = rag_retriever
        
    def process_query(
        self,
        query: str,
        context: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> Dict:
        """
        Query işleme pipeline.
        
        1. RAG context retrieval (opsiyonel)
        2. Prompt formatting
        3. LLM generation
        4. Post-processing
        """
        # RAG context
        rag_context = ""
        sources = []
        
        if self.rag:
            rag_results = self.rag.search(query, top_k=3)
            rag_context = "\n\n".join([doc.content for doc in rag_results])
            sources = [{"id": doc.id, "score": doc.score} for doc in rag_results]
        
        # Prompt oluştur
        if context or rag_context:
            final_context = context or rag_context
            prompt = f"Context:\n{final_context}\n\nQuestion: {query}\n\nAnswer:"
        else:
            prompt = query
        
        if system_prompt:
            prompt = f"System: {system_prompt}\n\n{prompt}"
        
        # Generate
        response = self.llm.generate_text(prompt, max_new_tokens=512)
        
        return {
            "query": query,
            "response": response,
            "sources": sources,
            "context_used": rag_context != ""
        }


# Global LLM servisi
llm_config = LLMConfig(
    model_name="microsoft/DialoGPT-medium",
    use_lora=True,
    use_rag=True
)
llm_service = LLMService(llm_config)
rag_retriever = RAGRetriever()
