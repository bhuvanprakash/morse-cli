package worker

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/indusbase/indus-queue/internal/models"
	"github.com/indusbase/indus-queue/internal/repository"
)

// Dispatcher polls queues and dispatches jobs to workers
type Dispatcher struct {
	jobRepo      *repository.JobRepository
	webhookRepo  *repository.WebhookRepository
	poolSize     int
	pollInterval int
	workerCh     chan *models.Job
	queues       []string
	wg           sync.WaitGroup
	ctx          context.Context
	cancel       context.CancelFunc
}

// NewDispatcher creates a new dispatcher
func NewDispatcher(jobRepo *repository.JobRepository, webhookRepo *repository.WebhookRepository, poolSize int, pollInterval int) *Dispatcher {
	ctx, cancel := context.WithCancel(context.Background())
	return &Dispatcher{
		jobRepo:      jobRepo,
		webhookRepo:  webhookRepo,
		poolSize:     poolSize,
		pollInterval: pollInterval,
		workerCh:     make(chan *models.Job, poolSize),
		queues:       []string{},
		ctx:          ctx,
		cancel:       cancel,
	}
}

// AddQueue adds a queue to be polled
func (d *Dispatcher) AddQueue(queueName string) {
	d.queues = append(d.queues, queueName)
}

// Start starts the dispatcher and worker pool
func (d *Dispatcher) Start() {
	// Start worker pool
	for i := 0; i < d.poolSize; i++ {
		d.wg.Add(1)
		go d.worker(i)
	}

	// Start polling
	d.wg.Add(1)
	go d.poller()
}

// Stop stops the dispatcher
func (d *Dispatcher) Stop() {
	d.cancel()
	d.wg.Wait()
}

// poller polls queues for new jobs
func (d *Dispatcher) poller() {
	defer d.wg.Done()

	ticker := time.NewTicker(time.Duration(d.pollInterval) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-d.ctx.Done():
			return
		case <-ticker.C:
			// Poll each queue
			for _, queueName := range d.queues {
				d.pollQueue(queueName)
			}
		}
	}
}

// pollQueue polls a specific queue for jobs
func (d *Dispatcher) pollQueue(queueName string) {
	workerID := uuid.New().String()
	jobs, err := d.jobRepo.Dequeue(d.ctx, queueName, workerID, d.poolSize)
	if err != nil {
		log.Printf("Error dequeuing from queue %s: %v", queueName, err)
		return
	}

	// Dispatch jobs to workers
	for _, job := range jobs {
		select {
		case d.workerCh <- job:
		default:
			// Worker channel full, requeue job
			log.Printf("Worker channel full, job %s requeued", job.ID)
		}
	}
}

// worker processes jobs from the worker channel
func (d *Dispatcher) worker(id int) {
	defer d.wg.Done()

	log.Printf("Worker %d started", id)

	for {
		select {
		case <-d.ctx.Done():
			log.Printf("Worker %d stopped", id)
			return
		case job := <-d.workerCh:
			d.processJob(job)
		}
	}
}

// processJob executes a job
func (d *Dispatcher) processJob(job *models.Job) {
	log.Printf("Worker processing job %s from queue %s", job.ID, job.QueueName)

	// Execute job
	executor := NewExecutor(d.jobRepo, d.webhookRepo)
	err := executor.Execute(d.ctx, job)

	if err != nil {
		log.Printf("Job %s failed: %v", job.ID, err)
		// Job will be retried by Fail() if needed
	} else {
		log.Printf("Job %s completed successfully", job.ID)
	}
}
